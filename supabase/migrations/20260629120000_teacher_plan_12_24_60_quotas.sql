-- Investor plan ladder: 12 / 24 / 60 included per month; Pro overage charges.

UPDATE public.rdm_config SET value = 12 WHERE key = 'teacher_free_assignments_per_month';
UPDATE public.rdm_config SET value = 24 WHERE key = 'teacher_starter_assignments_per_month';
UPDATE public.rdm_config SET value = 60 WHERE key = 'teacher_pro_assignments_per_month';
UPDATE public.rdm_config SET value = 12 WHERE key = 'teacher_free_live_classes_per_month';
UPDATE public.rdm_config SET value = 24 WHERE key = 'teacher_starter_live_classes_per_month';
UPDATE public.rdm_config SET value = 60 WHERE key = 'teacher_pro_live_classes_per_month';

INSERT INTO public.rdm_config (key, value)
VALUES
  ('teacher_assignment_overage_rdm', 20),
  ('teacher_live_class_overage_rdm', 100)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- NULL balance broke deduct_rdm (rdm >= amt never matches NULL).
UPDATE public.profiles SET rdm = 0 WHERE rdm IS NULL;

CREATE OR REPLACE FUNCTION public.deduct_rdm(uid uuid, amt integer) RETURNS integer
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO public
    AS $$
DECLARE
  new_balance integer;
  v_prev text;
BEGIN
  v_prev := NULLIF(current_setting('app.allow_profile_rdm_mutation', true), '');
  PERFORM set_config('app.allow_profile_rdm_mutation', '1', true);
  UPDATE public.profiles
  SET rdm = COALESCE(rdm, 0) - amt
  WHERE id = uid AND COALESCE(rdm, 0) >= amt
  RETURNING rdm INTO new_balance;
  IF v_prev IS NULL THEN
    PERFORM set_config('app.allow_profile_rdm_mutation', '0', true);
  ELSE
    PERFORM set_config('app.allow_profile_rdm_mutation', v_prev, true);
  END IF;
  RETURN new_balance;
END;
$$;

COMMENT ON FUNCTION public.deduct_rdm(uuid, integer) IS
  'Deduct RDM for a user (NULL balance treated as 0); returns new balance or NULL if insufficient.';
