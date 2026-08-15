-- One-time 500 RDM welcome for new teacher profiles (first time they complete
-- teacher onboarding). Existing onboarded teachers are not backfilled.

INSERT INTO public.rdm_config (key, value, description)
VALUES (
  'teacher_profile_welcome_rdm',
  500,
  'One-time RDM credited when a user first completes teacher-profile onboarding. Not paid again on later profile edits.'
)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS teacher_welcome_rdm_claimed_at timestamptz;

COMMENT ON COLUMN public.profiles.teacher_welcome_rdm_claimed_at IS
  'Set when teacher_profile_welcome_rdm is credited once at teacher onboarding. Never cleared.';

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

  IF NEW.teacher_welcome_rdm_claimed_at IS NULL THEN
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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_teacher_profile_welcome_rdm ON public.profiles;
CREATE TRIGGER trg_stamp_teacher_profile_welcome_rdm
  BEFORE INSERT OR UPDATE OF role, onboarding_complete, teacher_welcome_rdm_claimed_at
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.stamp_teacher_profile_welcome_rdm();

DROP TRIGGER IF EXISTS trg_credit_teacher_profile_welcome_rdm ON public.profiles;
CREATE TRIGGER trg_credit_teacher_profile_welcome_rdm
  AFTER INSERT OR UPDATE OF role, onboarding_complete
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.credit_teacher_profile_welcome_rdm();

COMMENT ON FUNCTION public.stamp_teacher_profile_welcome_rdm() IS
  'Stamps teacher_welcome_rdm_claimed_at the first time a profile becomes an onboarded teacher.';
COMMENT ON FUNCTION public.credit_teacher_profile_welcome_rdm() IS
  'Credits teacher_profile_welcome_rdm once when a user first completes teacher-profile onboarding.';
