-- Allow trusted SECURITY DEFINER helpers to set profiles.role (whitelist-backed),
-- while keeping direct client role writes blocked.

CREATE OR REPLACE FUNCTION public.profiles_prevent_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      IF current_setting('edublast.allow_profile_role_change', true) IS DISTINCT FROM 'on' THEN
        RAISE EXCEPTION 'profiles.role is not client-writable';
      END IF;
    END IF;
    -- Trusted RDM mutators (add_rdm / spend_rdm) set app.allow_profile_rdm_mutation=1.
    IF NEW.rdm IS DISTINCT FROM OLD.rdm
       AND NOT public.profiles_rdm_mutation_allowed() THEN
      RAISE EXCEPTION 'profiles.rdm is not client-writable';
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    IF NEW.role IS NOT NULL AND NEW.role NOT IN ('student', 'learner') THEN
      IF current_setting('edublast.allow_profile_role_change', true) IS DISTINCT FROM 'on' THEN
        RAISE EXCEPTION 'profiles.role insert not allowed for this value';
      END IF;
    END IF;
    IF coalesce(NEW.rdm, 0) <> 0
       AND NOT public.profiles_rdm_mutation_allowed() THEN
      RAISE EXCEPTION 'profiles.rdm must start at 0';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Bind when profiles already exists (prod). Fresh preview DBs bind after baseline.
DO $$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_profiles_prevent_privilege_escalation ON public.profiles;
    CREATE TRIGGER trg_profiles_prevent_privilege_escalation
      BEFORE INSERT OR UPDATE ON public.profiles
      FOR EACH ROW
      EXECUTE FUNCTION public.profiles_prevent_privilege_escalation();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.sync_my_profile_role_from_whitelist()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  uid uuid := auth.uid();
  user_email text;
  approved text;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT lower(email::text) INTO user_email
  FROM auth.users
  WHERE id = uid;

  IF user_email IS NULL OR btrim(user_email) = '' THEN
    RETURN NULL;
  END IF;

  SELECT ae.role INTO approved
  FROM public.approved_emails ae
  WHERE lower(ae.email) = user_email
  LIMIT 1;

  IF approved IS NULL OR approved NOT IN ('student', 'teacher') THEN
    RETURN NULL;
  END IF;

  PERFORM set_config('edublast.allow_profile_role_change', 'on', true);

  UPDATE public.profiles p
  SET role = approved
  WHERE p.id = uid
    AND coalesce(p.onboarding_complete, false) = false
    AND p.role IS DISTINCT FROM approved;

  RETURN approved;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_my_profile_role_from_whitelist() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_my_profile_role_from_whitelist() TO authenticated;

CREATE OR REPLACE FUNCTION public.complete_user_onboarding(p_payload jsonb)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  uid uuid := auth.uid();
  user_email text;
  approved text;
  target_role text;
  requested_role text;
  next_name text;
  next_visibility text;
  row_out public.profiles;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'invalid onboarding payload';
  END IF;

  SELECT lower(email::text) INTO user_email
  FROM auth.users
  WHERE id = uid;

  SELECT ae.role INTO approved
  FROM public.approved_emails ae
  WHERE lower(ae.email) = coalesce(user_email, '')
  LIMIT 1;

  requested_role := lower(coalesce(p_payload->>'role', ''));
  IF approved IN ('student', 'teacher') THEN
    target_role := approved;
  ELSIF requested_role IN ('student', 'teacher') THEN
    -- No whitelist row: never allow elevating to teacher from the client.
    IF requested_role = 'teacher' THEN
      RAISE EXCEPTION 'teacher whitelist required';
    END IF;
    target_role := 'student';
  ELSE
    SELECT coalesce(nullif(p.role, ''), 'student') INTO target_role
    FROM public.profiles p
    WHERE p.id = uid;
    target_role := coalesce(target_role, 'student');
    IF target_role = 'teacher' AND approved IS DISTINCT FROM 'teacher' THEN
      RAISE EXCEPTION 'teacher whitelist required';
    END IF;
  END IF;

  next_name := left(btrim(coalesce(p_payload->>'name', '')), 120);
  IF next_name = '' THEN
    next_name := CASE WHEN target_role = 'teacher' THEN 'Teacher' ELSE 'Student' END;
  END IF;

  next_visibility := lower(coalesce(p_payload->>'visibility', 'public'));
  IF next_visibility NOT IN ('public', 'invite_only') THEN
    next_visibility := 'public';
  END IF;

  PERFORM set_config('edublast.allow_profile_role_change', 'on', true);

  IF target_role = 'teacher' THEN
    UPDATE public.profiles p
    SET
      name = next_name,
      role = 'teacher',
      onboarding_complete = true,
      visibility = next_visibility,
      subjects = CASE
        WHEN jsonb_typeof(p_payload->'subjects') = 'array'
          THEN ARRAY(
            SELECT jsonb_array_elements_text(p_payload->'subjects')
          )
        ELSE p.subjects
      END,
      teaching_levels = CASE
        WHEN jsonb_typeof(p_payload->'teaching_levels') = 'array'
          THEN ARRAY(
            SELECT (jsonb_array_elements_text(p_payload->'teaching_levels'))::integer
          )
        ELSE p.teaching_levels
      END,
      exam_tags = CASE
        WHEN jsonb_typeof(p_payload->'exam_tags') = 'array'
          THEN ARRAY(
            SELECT jsonb_array_elements_text(p_payload->'exam_tags')
          )
        ELSE p.exam_tags
      END
    WHERE p.id = uid
    RETURNING * INTO row_out;
  ELSE
    UPDATE public.profiles p
    SET
      name = next_name,
      role = 'student',
      onboarding_complete = true,
      visibility = next_visibility,
      class_level = CASE
        WHEN coalesce(p_payload->>'class_level', '') ~ '^(11|12)$'
          THEN (p_payload->>'class_level')::integer
        ELSE p.class_level
      END,
      target_exam = nullif(btrim(coalesce(p_payload->>'target_exam', '')), ''),
      exam_tags = CASE
        WHEN jsonb_typeof(p_payload->'exam_tags') = 'array'
          THEN ARRAY(
            SELECT jsonb_array_elements_text(p_payload->'exam_tags')
          )
        ELSE p.exam_tags
      END,
      subject_combo = nullif(btrim(coalesce(p_payload->>'subject_combo', '')), ''),
      stream = coalesce(nullif(btrim(coalesce(p_payload->>'stream', '')), ''), 'science')
    WHERE p.id = uid
    RETURNING * INTO row_out;
  END IF;

  IF row_out.id IS NULL THEN
    RAISE EXCEPTION 'profile not found';
  END IF;

  IF target_role = 'teacher' THEN
    INSERT INTO public.user_roles (user_id, role)
    SELECT uid, 'teacher'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = uid AND ur.role = 'teacher'
    );
  END IF;

  RETURN row_out;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_user_onboarding(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_user_onboarding(jsonb) TO authenticated;

COMMENT ON FUNCTION public.sync_my_profile_role_from_whitelist() IS
  'Sets profiles.role from approved_emails for incomplete onboarding users.';
COMMENT ON FUNCTION public.complete_user_onboarding(jsonb) IS
  'Completes onboarding and sets role from whitelist (teacher only if whitelisted as teacher).';
