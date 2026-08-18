-- Restore INSERT of an already-stamped onboarded teacher has NEW.claimed_at
-- set and no OLD row, so the per-row OLD→NEW check would pay again.
-- Record just-stamped ids in a temp table (one row per id), not a session GUC,
-- because PostgreSQL fires every BEFORE ROW stamp before any AFTER ROW credit.

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
    CREATE TEMP TABLE IF NOT EXISTS teacher_welcome_rdm_just_stamped (
      profile_id uuid PRIMARY KEY
    ) ON COMMIT DELETE ROWS;
    INSERT INTO pg_temp.teacher_welcome_rdm_just_stamped (profile_id)
    VALUES (NEW.id)
    ON CONFLICT (profile_id) DO NOTHING;
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
  v_just_stamped boolean := false;
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

  -- Per-row first-claim lock: this row's stamp must have been null before
  -- this statement. Flipping onboarding_complete preserves the stamp on OLD.
  IF TG_OP = 'UPDATE' AND OLD.teacher_welcome_rdm_claimed_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT EXISTS (
      SELECT 1
      FROM pg_temp.teacher_welcome_rdm_just_stamped s
      WHERE s.profile_id = NEW.id
    )
    INTO v_just_stamped;
  EXCEPTION
    WHEN undefined_table THEN
      v_just_stamped := false;
  END;

  IF NOT v_just_stamped THEN
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

  BEGIN
    DELETE FROM pg_temp.teacher_welcome_rdm_just_stamped WHERE profile_id = NEW.id;
  EXCEPTION
    WHEN undefined_table THEN
      NULL;
  END;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.stamp_teacher_profile_welcome_rdm() IS
  'Stamps teacher_welcome_rdm_claimed_at once per profile. Records each newly stamped id in a temp table; never clears the stamp.';
COMMENT ON FUNCTION public.credit_teacher_profile_welcome_rdm() IS
  'Credits teacher_profile_welcome_rdm only when this statement just stamped the row. Restore INSERT of an already-stamped teacher does not pay again.';
