-- Atomic RDM deduction for live join (5) and schedule (10). Returns new balance or null if insufficient.
CREATE OR REPLACE FUNCTION public.deduct_rdm(uid uuid, amt integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_balance integer;
BEGIN
  UPDATE public.profiles
  SET rdm = rdm - amt
  WHERE id = uid AND rdm >= amt
  RETURNING rdm INTO new_balance;
  RETURN new_balance;
END;
$$;

COMMENT ON FUNCTION public.deduct_rdm IS 'Deduct RDM for a user; returns new balance or NULL if insufficient.';
