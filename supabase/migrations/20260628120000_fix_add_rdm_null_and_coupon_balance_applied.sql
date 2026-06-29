-- NULL + N stays NULL in Postgres; teachers with rdm IS NULL never received credits from add_rdm.
CREATE OR REPLACE FUNCTION public.add_rdm(uid uuid, amt integer) RETURNS integer
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
  SET rdm = COALESCE(rdm, 0) + amt
  WHERE id = uid
  RETURNING rdm INTO new_balance;
  IF v_prev IS NULL THEN
    PERFORM set_config('app.allow_profile_rdm_mutation', '0', true);
  ELSE
    PERFORM set_config('app.allow_profile_rdm_mutation', v_prev, true);
  END IF;
  IF new_balance IS NULL THEN
    RAISE EXCEPTION 'add_rdm: profile not found for %', uid;
  END IF;
  RETURN new_balance;
END;
$$;

COMMENT ON FUNCTION public.add_rdm(uuid, integer) IS
  'Add RDM to a user (NULL balance treated as 0). Raises if profile missing.';

ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS balance_applied_at timestamptz;

COMMENT ON COLUMN public.coupons.balance_applied_at IS
  'When RDM from this coupon was credited to profiles.rdm via add_rdm.';
