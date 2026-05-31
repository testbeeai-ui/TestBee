-- Migration to support foreground dwell time streaks and inactive day penalty calculations.

-- 1. Create penalty log table to track applied inactive day penalties and prevent double penalty deduction
CREATE TABLE IF NOT EXISTS public.inactive_day_penalties (
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  day date NOT NULL,
  penalty_rdm integer NOT NULL,
  penalized_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inactive_day_penalties_pkey PRIMARY KEY (user_id, day)
);

ALTER TABLE public.inactive_day_penalties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inactive_day_penalties_select_own"
  ON public.inactive_day_penalties FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 2. Insert new RDM config keys for configurable inactive day penalties
INSERT INTO public.rdm_config (key, value, description)
VALUES
  (
    'free_trial_inactive_penalty_rdm',
    50,
    'RDM deducted from a free-trial user when they spend less than 30 minutes on-site during a trial day.'
  ),
  (
    'free_inactive_penalty_rdm',
    50,
    'RDM deducted from a free plan user when they spend less than 30 minutes on-site during a calendar day.'
  )
ON CONFLICT (key) DO NOTHING;

-- 3. Create reactive reconcile_inactive_day_penalties function to retroactively deduct RDM for inactive days
CREATE OR REPLACE FUNCTION public.reconcile_inactive_day_penalties()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_plan_tier text;
  v_activated_at timestamptz;
  v_created_at timestamptz;
  v_start_date date;
  v_end_date date := (now() - interval '1 day')::date;
  v_date date;
  v_presence bigint;
  v_penalty integer;
  v_penalties_applied integer := 0;
  v_total_deducted integer := 0;
  v_current_rdm integer;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  SELECT plan_tier, free_trial_activated_at, created_at, rdm
  INTO v_plan_tier, v_activated_at, v_created_at, v_current_rdm
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'profile_not_found');
  END IF;

  -- 1. Determine plan and check if user qualifies for penalty (only free_trial and free plans)
  v_plan_tier := lower(coalesce(v_plan_tier, 'free'));
  IF v_plan_tier NOT IN ('free_trial', 'free') THEN
    RETURN jsonb_build_object('ok', true, 'noop', true, 'reason', 'plan_exempt');
  END IF;

  -- 2. Fetch penalty configuration from rdm_config
  IF v_plan_tier = 'free_trial' THEN
    SELECT COALESCE(
      (SELECT value::integer FROM public.rdm_config WHERE key = 'free_trial_inactive_penalty_rdm'),
      50
    ) INTO v_penalty;
    v_start_date := (v_activated_at + interval '1 day')::date;
  ELSE
    SELECT COALESCE(
      (SELECT value::integer FROM public.rdm_config WHERE key = 'free_inactive_penalty_rdm'),
      50
    ) INTO v_penalty;
    -- Start checking free users from greatest of created_at+1 or 2026-05-01 to avoid backfilling infinite history
    v_start_date := greatest((v_created_at + interval '1 day')::date, '2026-05-01'::date);
  END IF;

  v_penalty := greatest(0, coalesce(v_penalty, 50));

  -- If start date is after yesterday, nothing to check
  IF v_start_date > v_end_date THEN
    RETURN jsonb_build_object('ok', true, 'noop', true, 'reason', 'no_completed_days');
  END IF;

  -- 3. Loop through calendar days
  v_date := v_start_date;
  WHILE v_date <= v_end_date LOOP
    -- Check if already penalized
    IF NOT EXISTS (
      SELECT 1 FROM public.inactive_day_penalties
      WHERE user_id = v_user_id AND day = v_date
    ) THEN
      -- Get presence time for this day
      SELECT COALESCE(
        (SELECT presence_ms FROM public.user_study_day_totals WHERE user_id = v_user_id AND day = v_date),
        0
      ) INTO v_presence;

      -- If on-site foreground dwell time is less than 30 minutes (1,800,000 ms), apply penalty
      IF v_presence < 1800000 THEN
        -- Record penalty in log
        INSERT INTO public.inactive_day_penalties (user_id, day, penalty_rdm, penalized_at)
        VALUES (v_user_id, v_date, v_penalty, now())
        ON CONFLICT (user_id, day) DO NOTHING;

        v_total_deducted := v_total_deducted + v_penalty;
        v_penalties_applied := v_penalties_applied + 1;
      END IF;
    END IF;

    v_date := v_date + 1;
  END LOOP;

  -- 4. Apply deduction to profile if any penalties were registered
  IF v_total_deducted > 0 THEN
    UPDATE public.profiles
    SET rdm = greatest(0, rdm - v_total_deducted)
    WHERE id = v_user_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'penalties_applied', v_penalties_applied,
    'total_deducted', v_total_deducted
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_inactive_day_penalties() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reconcile_inactive_day_penalties() TO authenticated;

-- 4. Update get_study_streak_summary function to calculate streaks based strictly on 30+ minutes site presence
CREATE OR REPLACE FUNCTION public.get_study_streak_summary(p_today date)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  streak_val int := 0;
  d date;
  d_anchor date;
  month_start date := date_trunc('month', p_today::timestamp)::date;
  month_end date := (date_trunc('month', p_today::timestamp) + interval '1 month - 1 day')::date;
  active_month int := 0;
BEGIN
  if uid is null then
    return json_build_object('streak', 0, 'activeDaysThisMonth', 0);
  end if;

  select count(*)::int into active_month
  from public.user_study_day_totals
  where user_id = uid
    and day >= month_start
    and day <= month_end
    and presence_ms >= 1800000;

  select max(day) into d_anchor
  from public.user_study_day_totals
  where user_id = uid
    and day <= p_today
    and presence_ms >= 1800000;

  if d_anchor is null then
    return json_build_object(
      'streak', 0,
      'activeDaysThisMonth', coalesce(active_month, 0)
    );
  end if;

  d := d_anchor;
  loop
    exit when not exists (
      select 1
      from public.user_study_day_totals
      where user_id = uid
        and day = d
        and presence_ms >= 1800000
    );
    streak_val := streak_val + 1;
    d := d - 1;
    exit when streak_val > 10000;
  end loop;

  return json_build_object(
    'streak', streak_val,
    'activeDaysThisMonth', coalesce(active_month, 0)
  );
end;
$$;
