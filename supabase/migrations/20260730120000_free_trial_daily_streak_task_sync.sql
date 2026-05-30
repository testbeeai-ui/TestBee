-- Per-task sync for Day 2–10 daily streak (partial progress in profiles.free_trial_daily_streak).

CREATE OR REPLACE FUNCTION public._free_trial_streak_day_task_ids(p_state jsonb, p_day_key text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    ARRAY(
      SELECT jsonb_array_elements_text(
        COALESCE(p_state -> p_day_key -> 'task_ids', '[]'::jsonb)
      )
    ),
    ARRAY[]::text[]
  );
$$;

CREATE OR REPLACE FUNCTION public._free_trial_streak_active_day(p_state jsonb)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  RETURN public._free_trial_next_streak_day(COALESCE(p_state, '{}'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_free_trial_daily_streak_task(
  p_day integer,
  p_task_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_site_claimed timestamptz;
  v_state jsonb;
  v_day_key text;
  v_now timestamptz := now();
  v_expected_day integer;
  v_day jsonb;
  v_task_ids text[];
  v_tasks jsonb;
  v_already boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  IF p_day IS NULL OR p_day < 2 OR p_day > 10 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_day');
  END IF;

  IF p_task_id IS NULL OR NOT (p_task_id = ANY (public._free_trial_daily_task_ids())) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_task_id');
  END IF;

  SELECT onboarding_reward_claimed_at, free_trial_daily_streak
  INTO v_site_claimed, v_state
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'profile_not_found');
  END IF;

  IF v_site_claimed IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'site_tour_not_claimed');
  END IF;

  v_state := COALESCE(v_state, '{}'::jsonb);
  v_day_key := p_day::text;
  v_day := COALESCE(v_state -> v_day_key, '{}'::jsonb);

  IF COALESCE(v_day ->> 'claimed_at', '') <> '' THEN
    v_task_ids := public._free_trial_streak_day_task_ids(v_state, v_day_key);
    RETURN jsonb_build_object(
      'ok', true,
      'noop', true,
      'already_claimed', true,
      'task_ids', to_jsonb(v_task_ids),
      'trial_day', p_day
    );
  END IF;

  v_expected_day := public._free_trial_streak_active_day(v_state);
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

  v_task_ids := public._free_trial_streak_day_task_ids(v_state, v_day_key);
  v_already := p_task_id = ANY (v_task_ids);

  IF NOT v_already THEN
    v_task_ids := array_append(v_task_ids, p_task_id);
  END IF;

  v_tasks := COALESCE(v_day -> 'tasks', '{}'::jsonb);
  IF COALESCE(v_tasks -> p_task_id ->> 'completed_at', '') = '' THEN
    v_tasks := jsonb_set(
      v_tasks,
      ARRAY[p_task_id],
      jsonb_build_object('completed_at', v_now),
      true
    );
  END IF;

  v_day := jsonb_build_object(
    'task_ids', to_jsonb(v_task_ids),
    'tasks', v_tasks
  );

  IF COALESCE((v_state -> v_day_key) ->> 'claimed_at', '') = '' THEN
    v_state := jsonb_set(v_state, ARRAY[v_day_key], v_day, true);
  END IF;

  UPDATE public.profiles
  SET free_trial_daily_streak = v_state
  WHERE id = v_user_id;

  RETURN jsonb_build_object(
    'ok', true,
    'noop', v_already,
    'task_ids', to_jsonb(v_task_ids),
    'trial_day', p_day
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sync_free_trial_daily_streak_task(integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_free_trial_daily_streak_task(integer, text) TO authenticated;

COMMENT ON FUNCTION public.sync_free_trial_daily_streak_task(integer, text) IS
  'Record one Day-2+ daily checklist task (t1–t6) on profiles.free_trial_daily_streak for the active streak day.';

CREATE OR REPLACE FUNCTION public.reset_free_trial_daily_streak_day(p_day integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_state jsonb;
  v_day_key text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  IF p_day IS NULL OR p_day < 2 OR p_day > 10 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_day');
  END IF;

  SELECT free_trial_daily_streak
  INTO v_state
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'profile_not_found');
  END IF;

  v_state := COALESCE(v_state, '{}'::jsonb);
  v_day_key := p_day::text;

  IF COALESCE(v_state -> v_day_key ->> 'claimed_at', '') <> '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'day_already_claimed');
  END IF;

  v_state := v_state - v_day_key;

  UPDATE public.profiles
  SET free_trial_daily_streak = v_state
  WHERE id = v_user_id;

  RETURN jsonb_build_object('ok', true, 'trial_day', p_day);
END;
$$;

REVOKE ALL ON FUNCTION public.reset_free_trial_daily_streak_day(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_free_trial_daily_streak_day(integer) TO authenticated;

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
  v_stored_tasks text[];
  v_day jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  IF p_day IS NULL OR p_day < 2 OR p_day > 10 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_day');
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

  v_state := COALESCE(v_state, '{}'::jsonb);
  v_day_key := p_day::text;
  v_day := COALESCE(v_state -> v_day_key, '{}'::jsonb);

  IF COALESCE(v_day ->> 'claimed_at', '') <> '' THEN
    SELECT rdm INTO v_new_balance FROM public.profiles WHERE id = v_user_id;
    RETURN jsonb_build_object(
      'ok', true,
      'already_claimed', true,
      'amount', 0,
      'balance', COALESCE(v_new_balance, 0),
      'trial_day', p_day
    );
  END IF;

  v_expected_day := public._free_trial_next_streak_day(v_state);
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

  v_stored_tasks := public._free_trial_streak_day_task_ids(v_state, v_day_key);
  IF NOT public._free_trial_daily_tasks_valid(v_stored_tasks) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'incomplete_tasks');
  END IF;

  SELECT COALESCE(
    (SELECT value::integer FROM public.rdm_config WHERE key = 'free_trial_daily_streak_reward_rdm'),
    80
  )
  INTO v_amount;

  v_amount := GREATEST(0, COALESCE(v_amount, 80));
  v_new_balance := public.add_rdm(v_user_id, v_amount);

  v_day := jsonb_set(
    v_day,
    '{task_ids}',
    to_jsonb(v_stored_tasks),
    true
  );
  v_day := jsonb_set(v_day, '{completed_at}', to_jsonb(v_now), true);
  v_day := jsonb_set(v_day, '{claimed_at}', to_jsonb(v_now), true);

  v_state := jsonb_set(v_state, ARRAY[v_day_key], v_day, true);

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

COMMENT ON COLUMN public.profiles.free_trial_daily_streak IS
  'Per streak day ("2".."10"): task_ids + tasks.{tN}.completed_at while in progress; claimed_at when 6/6 RDM paid.';
