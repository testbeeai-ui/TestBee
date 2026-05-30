-- Day 2–10 daily streak: per-day completion + RDM claim (admin-configurable amount).

INSERT INTO public.rdm_config (key, value, description)
VALUES
  (
    'free_trial_daily_streak_reward_rdm',
    80,
    'RDM credited when a student completes all 6 Day-2+ daily checklist tasks for the current trial day.'
  )
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS free_trial_daily_streak jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.profiles.free_trial_daily_streak IS
  'Per trial-day map (day "2".."10") with completed_at, claimed_at, task_ids for admin / streak rewards.';

CREATE OR REPLACE FUNCTION public._free_trial_day2_unlock_at(p_claimed_at timestamptz)
RETURNS timestamptz
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT (
    date_trunc('day', p_claimed_at AT TIME ZONE 'UTC')
    + interval '1 day'
    + interval '9 hours'
  ) AT TIME ZONE 'UTC';
$$;

CREATE OR REPLACE FUNCTION public._free_trial_trial_day_number(
  p_claimed_at timestamptz,
  p_now timestamptz DEFAULT now()
)
RETURNS integer
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_unlock timestamptz;
  v_diff_days integer;
BEGIN
  IF p_claimed_at IS NULL THEN
    RETURN 1;
  END IF;

  v_unlock := public._free_trial_day2_unlock_at(p_claimed_at);
  IF p_now < v_unlock THEN
    RETURN 1;
  END IF;

  v_diff_days := floor(extract(epoch FROM (p_now - v_unlock)) / 86400.0)::integer;
  RETURN least(10, 2 + v_diff_days);
END;
$$;

CREATE OR REPLACE FUNCTION public._free_trial_daily_task_ids()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT ARRAY['t1', 't2', 't3', 't4', 't5', 't6']::text[];
$$;

CREATE OR REPLACE FUNCTION public._free_trial_daily_tasks_valid(p_tasks text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT
    p_tasks IS NOT NULL
    AND array_length(p_tasks, 1) = 6
    AND NOT EXISTS (
      SELECT 1
      FROM unnest(public._free_trial_daily_task_ids()) AS required(task_id)
      WHERE NOT (required.task_id = ANY (p_tasks))
    )
    AND NOT EXISTS (
      SELECT 1
      FROM unnest(p_tasks) AS provided(task_id)
      WHERE provided.task_id <> ALL (public._free_trial_daily_task_ids())
    );
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

REVOKE ALL ON FUNCTION public.claim_free_trial_daily_streak_reward(integer, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_free_trial_daily_streak_reward(integer, text[]) TO authenticated;

COMMENT ON FUNCTION public.claim_free_trial_daily_streak_reward(integer, text[]) IS
  'Credits free_trial_daily_streak_reward_rdm after all 6 daily tasks for the current trial day (2–10).';
