-- Harden free-trial reward eligibility against revoke/reactivate and concurrent activation.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS free_trial_welcome_credited_at timestamptz;

COMMENT ON COLUMN public.profiles.free_trial_welcome_credited_at IS
  'Timestamp when the one-time free-trial welcome RDM bonus was credited.';

-- Existing activated trial users already passed through activate-trial before this marker existed.
UPDATE public.profiles
SET free_trial_welcome_credited_at = free_trial_activated_at
WHERE free_trial_welcome_credited_at IS NULL
  AND free_trial_activated_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.claim_free_trial_welcome_rdm()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_free_trial_activated boolean;
  v_credited_at timestamptz;
  v_amount integer;
  v_balance integer;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  SELECT free_trial_activated, free_trial_welcome_credited_at, rdm
  INTO v_free_trial_activated, v_credited_at, v_balance
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'profile_not_found');
  END IF;

  IF v_free_trial_activated IS DISTINCT FROM true THEN
    RETURN jsonb_build_object('ok', false, 'error', 'free_trial_inactive');
  END IF;

  IF v_credited_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already_credited', true,
      'amount', 0,
      'balance', COALESCE(v_balance, 0)
    );
  END IF;

  SELECT COALESCE(
    (SELECT value::integer FROM public.rdm_config WHERE key = 'free_trial_welcome_rdm'),
    500
  )
  INTO v_amount;

  v_amount := GREATEST(0, COALESCE(v_amount, 500));
  v_balance := public.add_rdm(v_user_id, v_amount);

  UPDATE public.profiles
  SET free_trial_welcome_credited_at = now()
  WHERE id = v_user_id;

  RETURN jsonb_build_object(
    'ok', true,
    'already_credited', false,
    'amount', v_amount,
    'balance', COALESCE(v_balance, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_free_trial_welcome_rdm() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_free_trial_welcome_rdm() TO authenticated;

COMMENT ON FUNCTION public.claim_free_trial_welcome_rdm() IS
  'One-time free-trial welcome RDM credit guarded by a row lock and durable credited timestamp.';
