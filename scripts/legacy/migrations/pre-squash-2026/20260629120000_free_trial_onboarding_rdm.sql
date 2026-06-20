-- Free trial onboarding: admin RDM config, profile checklist progress, one-time claim RPC.

INSERT INTO public.rdm_config (key, value, description)
VALUES
  (
    'free_trial_checklist_reward_rdm',
    100,
    'RDM paid when a student completes all 12 free-trial onboarding checklist tasks and claims (also drives welcome-bonus copy in the trial wizard).'
  )
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_reward_progress jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS onboarding_reward_claimed_at timestamptz;

COMMENT ON COLUMN public.profiles.onboarding_reward_progress IS
  'Free-trial onboarding checklist task completion map (task id -> true).';
COMMENT ON COLUMN public.profiles.onboarding_reward_claimed_at IS
  'Timestamp when the student claimed the free-trial checklist/lib checklist RDM reward.';

CREATE OR REPLACE FUNCTION public._free_trial_onboarding_task_ids()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT ARRAY[
    'magic_wall',
    'lessons',
    'prep_classes',
    'prep_mcq',
    'gyan_browse',
    'gyan_post',
    'gyan_engagement',
    'earn_buddy',
    'earn_challenge',
    'news_blog',
    'edufund',
    'profile'
  ]::text[];
$$;

CREATE OR REPLACE FUNCTION public._free_trial_onboarding_all_complete(p_progress jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM unnest(public._free_trial_onboarding_task_ids()) AS tid(task_id)
    WHERE COALESCE((p_progress ->> tid.task_id)::boolean, false) IS NOT TRUE
  );
$$;

CREATE OR REPLACE FUNCTION public.claim_free_trial_checklist_reward()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_progress jsonb;
  v_claimed_at timestamptz;
  v_amount integer;
  v_new_balance integer;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  SELECT onboarding_reward_progress, onboarding_reward_claimed_at
  INTO v_progress, v_claimed_at
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'profile_not_found');
  END IF;

  IF v_claimed_at IS NOT NULL THEN
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
  SET onboarding_reward_claimed_at = now()
  WHERE id = v_user_id;

  RETURN jsonb_build_object(
    'ok', true,
    'already_claimed', false,
    'amount', v_amount,
    'balance', v_new_balance
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_free_trial_checklist_reward() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_free_trial_checklist_reward() TO authenticated;

COMMENT ON FUNCTION public.claim_free_trial_checklist_reward() IS
  'One-time RDM claim after all free-trial onboarding checklist tasks are complete. Amount from rdm_config.free_trial_checklist_reward_rdm.';
