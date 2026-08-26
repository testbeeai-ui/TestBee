-- Requested student role wins over a leftover teacher whitelist row.
-- Teacher still requires approved_emails.role = teacher.

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
  IF requested_role = 'student' THEN
    target_role := 'student';
  ELSIF requested_role = 'teacher' THEN
    IF approved IS DISTINCT FROM 'teacher' THEN
      RAISE EXCEPTION 'teacher whitelist required';
    END IF;
    target_role := 'teacher';
  ELSIF approved IN ('student', 'teacher') THEN
    target_role := approved;
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

COMMENT ON FUNCTION public.complete_user_onboarding(jsonb) IS
  'Completes onboarding. Requested student wins over teacher whitelist; teacher still requires whitelist.';
