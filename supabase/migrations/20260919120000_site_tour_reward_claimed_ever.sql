-- Site-tour +100 RDM reward becomes a true one-time-per-account grant.
--
-- Problem: `onboarding_reward_claimed_at` is cleared by the "Reset trial to Day 1"
-- helper, which let a user re-finish the tour and claim another +100 RDM on every
-- reset. We add a persistent flag that survives resets and gate the grant on it.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS free_trial_checklist_reward_claimed_ever boolean NOT NULL DEFAULT false;

-- Backfill: anyone who has ever claimed (claimed_at set) already received the one-time +100.
UPDATE public.profiles
SET free_trial_checklist_reward_claimed_ever = true
WHERE onboarding_reward_claimed_at IS NOT NULL
  AND free_trial_checklist_reward_claimed_ever = false;

CREATE OR REPLACE FUNCTION public.claim_free_trial_checklist_reward() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_id uuid;
  v_progress jsonb;
  v_claimed_at timestamptz;
  v_claimed_ever boolean;
  v_amount integer;
  v_new_balance integer;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  SELECT onboarding_reward_progress,
         onboarding_reward_claimed_at,
         free_trial_checklist_reward_claimed_ever
  INTO v_progress, v_claimed_at, v_claimed_ever
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'profile_not_found');
  END IF;

  -- Already claimed in the current trial cycle: idempotent no-op.
  IF v_claimed_at IS NOT NULL THEN
    SELECT rdm INTO v_new_balance FROM public.profiles WHERE id = v_user_id;
    RETURN jsonb_build_object(
      'ok', true,
      'already_claimed', true,
      'amount', 0,
      'balance', COALESCE(v_new_balance, 0)
    );
  END IF;

  -- One-time-ever guard: the +100 RDM is granted only once per account, even after
  -- a trial reset cleared onboarding_reward_claimed_at. Re-mark claimed_at (so the
  -- daily-streak unlock works and the tour stops auto-opening) but grant nothing.
  IF v_claimed_ever THEN
    UPDATE public.profiles
    SET onboarding_reward_claimed_at = now()
    WHERE id = v_user_id;
    SELECT rdm INTO v_new_balance FROM public.profiles WHERE id = v_user_id;
    RETURN jsonb_build_object(
      'ok', true,
      'already_claimed', true,
      'amount', 0,
      'balance', COALESCE(v_new_balance, 0)
    );
  END IF;

  IF NOT public._free_trial_onboarding_all_complete(v_progress) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'checklist_incomplete');
  END IF;

  SELECT COALESCE(
    (SELECT value::integer FROM public.rdm_config WHERE key = 'free_trial_checklist_reward_rdm'),
    100
  )
  INTO v_amount;

  v_amount := GREATEST(0, COALESCE(v_amount, 100));

  v_new_balance := public.add_rdm(v_user_id, v_amount);

  UPDATE public.profiles
  SET onboarding_reward_claimed_at = now(),
      free_trial_checklist_reward_claimed_ever = true
  WHERE id = v_user_id;

  RETURN jsonb_build_object(
    'ok', true,
    'already_claimed', false,
    'amount', v_amount,
    'balance', v_new_balance
  );
END;
$$;

COMMENT ON FUNCTION public.claim_free_trial_checklist_reward() IS 'One-time-per-account RDM claim after all free-trial onboarding checklist tasks are complete. Guarded by free_trial_checklist_reward_claimed_ever so a trial reset cannot re-grant it. Amount from rdm_config.free_trial_checklist_reward_rdm.';
