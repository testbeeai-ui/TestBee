-- Enforce sequential streak day claims (Day 2 before Day 3, etc.).

CREATE OR REPLACE FUNCTION public._free_trial_next_streak_day(p_state jsonb)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_day integer;
BEGIN
  FOR v_day IN 2..10 LOOP
    IF COALESCE(p_state -> v_day::text ->> 'claimed_at', '') = '' THEN
      RETURN v_day;
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_free_trial_daily_streak_reward(
  p_day integer,
  p_task_ids text[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_claimed_at timestamptz;
  v_state jsonb;
  v_day_key text;
  v_amount integer;
  v_new_balance integer;
  v_now timestamptz := now();
  v_expected_day integer;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  IF p_day IS NULL OR p_day < 2 OR p_day > 10 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_day');
  END IF;

  IF NOT public._free_trial_daily_tasks_valid(p_task_ids) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'incomplete_tasks');
  END IF;

  SELECT onboarding_reward_claimed_at, free_trial_daily_streak
  INTO v_claimed_at, v_state
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'profile_not_found');
  END IF;

  IF v_claimed_at IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'site_tour_not_claimed');
  END IF;

  v_day_key := p_day::text;
  IF COALESCE(v_state -> v_day_key ->> 'claimed_at', '') <> '' THEN
    SELECT rdm INTO v_new_balance FROM public.profiles WHERE id = v_user_id;
    RETURN jsonb_build_object(
      'ok', true,
      'already_claimed', true,
      'amount', 0,
      'balance', COALESCE(v_new_balance, 0),
      'trial_day', p_day
    );
  END IF;

  v_expected_day := public._free_trial_next_streak_day(COALESCE(v_state, '{}'::jsonb));
  IF v_expected_day IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'all_days_complete');
  END IF;

  IF p_day <> v_expected_day THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'wrong_day',
      'expected_day', v_expected_day
    );
  END IF;

  SELECT COALESCE(
    (SELECT value::integer FROM public.rdm_config WHERE key = 'free_trial_daily_streak_reward_rdm'),
    80
  )
  INTO v_amount;

  v_amount := GREATEST(0, COALESCE(v_amount, 80));
  v_new_balance := public.add_rdm(v_user_id, v_amount);

  v_state := COALESCE(v_state, '{}'::jsonb);
  v_state := jsonb_set(
    v_state,
    ARRAY[v_day_key],
    jsonb_build_object(
      'task_ids', to_jsonb(p_task_ids),
      'completed_at', v_now,
      'claimed_at', v_now
    ),
    true
  );

  UPDATE public.profiles
  SET free_trial_daily_streak = v_state
  WHERE id = v_user_id;

  RETURN jsonb_build_object(
    'ok', true,
    'already_claimed', false,
    'amount', v_amount,
    'balance', v_new_balance,
    'trial_day', p_day
  );
END;
$$;
