-- Credit UPDATE from per-row OLD → NEW claimed_at (a single GUC id only kept
-- the last row). INSERT has no OLD, so restore/reinsert of an already-stamped
-- onboarded teacher still needs the just-stamped id list.

CREATE OR REPLACE FUNCTION public.stamp_teacher_profile_welcome_rdm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  qualifying boolean;
  was_qualifying boolean;
  stamped text;
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
    -- AFTER INSERT cannot see the incoming stamp; record ids this statement
    -- actually stamped so restore/reinsert of a claimed row does not pay.
    IF TG_OP = 'INSERT' THEN
      stamped := nullif(current_setting('app.teacher_welcome_rdm_just_stamped', true), '');
      IF stamped IS NULL THEN
        PERFORM set_config('app.teacher_welcome_rdm_just_stamped', NEW.id::text, true);
      ELSIF NEW.id::text <> ALL (string_to_array(stamped, ',')) THEN
        PERFORM set_config(
          'app.teacher_welcome_rdm_just_stamped',
          stamped || ',' || NEW.id::text,
          true
        );
      END IF;
    END IF;
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
  stamped text;
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

  -- INSERT has no OLD. A restore that already carries claimed_at looks like a
  -- first claim unless BEFORE recorded this id as just stamped.
  IF TG_OP = 'INSERT' THEN
    stamped := nullif(current_setting('app.teacher_welcome_rdm_just_stamped', true), '');
    IF stamped IS NULL OR NOT (NEW.id::text = ANY (string_to_array(stamped, ','))) THEN
      RETURN NEW;
    END IF;
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

COMMENT ON FUNCTION public.stamp_teacher_profile_welcome_rdm() IS
  'Stamps teacher_welcome_rdm_claimed_at once per profile. Never clears the stamp. INSERT appends newly stamped ids to app.teacher_welcome_rdm_just_stamped.';
COMMENT ON FUNCTION public.credit_teacher_profile_welcome_rdm() IS
  'Credits teacher_profile_welcome_rdm once per row when claimed_at goes from null to set. UPDATE uses per-row OLD/NEW; INSERT uses the just-stamped id list so restore/reinsert of a claimed row does not pay again.';
