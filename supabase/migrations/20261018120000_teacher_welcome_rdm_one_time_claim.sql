-- Make teacher welcome RDM a true first-claim grant.
-- The BEFORE trigger preserves teacher_welcome_rdm_claimed_at and never clears it,
-- so the AFTER trigger cannot treat a non-null stamp as "this statement just claimed".
-- Credit only when THIS statement's BEFORE trigger stamped a previously-null claim.

CREATE OR REPLACE FUNCTION public.stamp_teacher_profile_welcome_rdm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  qualifying boolean;
  was_qualifying boolean;
BEGIN
  PERFORM set_config('app.teacher_welcome_rdm_just_stamped', '', true);

  IF TG_OP = 'UPDATE'
     AND OLD.teacher_welcome_rdm_claimed_at IS NOT NULL THEN
    NEW.teacher_welcome_rdm_claimed_at := OLD.teacher_welcome_rdm_claimed_at;
  END IF;

  qualifying :=
    NEW.role = 'teacher'
    AND coalesce(NEW.onboarding_complete, false) IS TRUE;

  IF NOT qualifying THEN
    RETURN NEW;
  END IF;

  was_qualifying :=
    TG_OP = 'UPDATE'
    AND OLD.role = 'teacher'
    AND coalesce(OLD.onboarding_complete, false) IS TRUE;

  IF was_qualifying THEN
    RETURN NEW;
  END IF;

  IF NEW.teacher_welcome_rdm_claimed_at IS NULL THEN
    NEW.teacher_welcome_rdm_claimed_at := now();
    PERFORM set_config('app.teacher_welcome_rdm_just_stamped', NEW.id::text, true);
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.credit_teacher_profile_welcome_rdm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  qualifying boolean;
  was_qualifying boolean;
  v_amount integer;
BEGIN
  qualifying :=
    NEW.role = 'teacher'
    AND coalesce(NEW.onboarding_complete, false) IS TRUE;

  IF NOT qualifying THEN
    RETURN NEW;
  END IF;

  was_qualifying :=
    TG_OP = 'UPDATE'
    AND OLD.role = 'teacher'
    AND coalesce(OLD.onboarding_complete, false) IS TRUE;

  IF was_qualifying THEN
    RETURN NEW;
  END IF;

  -- First-claim lock: OLD stamp is preserved across onboarding_complete false→true.
  -- Only pay when this statement just stamped a previously-null claim.
  IF TG_OP = 'UPDATE' AND OLD.teacher_welcome_rdm_claimed_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF current_setting('app.teacher_welcome_rdm_just_stamped', true) IS DISTINCT FROM NEW.id::text THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(
    (SELECT c.value FROM public.rdm_config c WHERE c.key = 'teacher_profile_welcome_rdm'),
    500
  )
  INTO v_amount;

  v_amount := greatest(0, coalesce(v_amount, 0));
  IF v_amount > 0 THEN
    PERFORM public.add_rdm(NEW.id, v_amount);
  END IF;

  PERFORM set_config('app.teacher_welcome_rdm_just_stamped', '', true);

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.stamp_teacher_profile_welcome_rdm() IS
  'Stamps teacher_welcome_rdm_claimed_at once. Never clears the stamp. Sets app.teacher_welcome_rdm_just_stamped only when it first stamps.';
COMMENT ON FUNCTION public.credit_teacher_profile_welcome_rdm() IS
  'Credits teacher_profile_welcome_rdm only on the first claim. Flipping onboarding_complete after the stamp exists does not pay again.';
