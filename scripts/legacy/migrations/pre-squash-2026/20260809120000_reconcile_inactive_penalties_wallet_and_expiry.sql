-- Inactive-day penalties: honor subscription_expires_at and use wallet-safe RDM mutation.

CREATE OR REPLACE FUNCTION public.reconcile_inactive_day_penalties()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_plan_tier text;
  v_free_trial_activated boolean;
  v_activated_at timestamptz;
  v_subscription_started_at timestamptz;
  v_subscription_expires_at timestamptz;
  v_created_at timestamptz;
  v_start_date date;
  v_end_date date := (now() - interval '1 day')::date;
  v_date date;
  v_presence bigint;
  v_penalty integer := 0;
  v_penalties_applied integer := 0;
  v_total_deducted integer := 0;
  v_guc_prev text;

  v_milestone_days integer;
  v_milestone_rdm integer;
  v_d_anchor date;
  v_streak_val integer := 0;
  v_streak_start_date date;
  v_milestone_credited boolean := false;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  SELECT
    plan_tier,
    free_trial_activated,
    free_trial_activated_at,
    subscription_started_at,
    subscription_expires_at,
    created_at
  INTO
    v_plan_tier,
    v_free_trial_activated,
    v_activated_at,
    v_subscription_started_at,
    v_subscription_expires_at,
    v_created_at
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'profile_not_found');
  END IF;

  v_plan_tier := lower(coalesce(v_plan_tier, 'free'));

  -- Match app normalizePlanTier: expired paid grants revert to free / free_trial.
  IF v_subscription_expires_at IS NOT NULL AND v_subscription_expires_at <= now() THEN
    IF coalesce(v_free_trial_activated, false) THEN
      v_plan_tier := 'free_trial';
    ELSE
      v_plan_tier := 'free';
    END IF;
  ELSIF v_plan_tier = 'scholar' THEN
    v_plan_tier := 'starter';
  ELSIF v_plan_tier IN ('champion', 'pro_plus') THEN
    v_plan_tier := 'pro';
  END IF;

  CASE v_plan_tier
    WHEN 'free_trial' THEN
      SELECT COALESCE(
        (SELECT value::integer FROM public.rdm_config WHERE key = 'free_trial_inactive_penalty_rdm'),
        50
      ) INTO v_penalty;
      IF v_activated_at IS NOT NULL THEN
        v_start_date := (v_activated_at + interval '1 day')::date;
      ELSE
        v_start_date := (v_created_at + interval '1 day')::date;
      END IF;
    WHEN 'free' THEN
      SELECT COALESCE(
        (SELECT value::integer FROM public.rdm_config WHERE key = 'free_inactive_penalty_rdm'),
        50
      ) INTO v_penalty;
      v_start_date := greatest((v_created_at + interval '1 day')::date, '2026-05-01'::date);
    WHEN 'starter' THEN
      SELECT COALESCE(
        (SELECT value::integer FROM public.rdm_config WHERE key = 'starter_inactive_penalty_rdm'),
        50
      ) INTO v_penalty;
      v_start_date := greatest(
        (coalesce(v_subscription_started_at, v_created_at) + interval '1 day')::date,
        '2026-05-01'::date
      );
    WHEN 'pro' THEN
      SELECT COALESCE(
        (SELECT value::integer FROM public.rdm_config WHERE key = 'pro_inactive_penalty_rdm'),
        25
      ) INTO v_penalty;
      v_start_date := greatest(
        (coalesce(v_subscription_started_at, v_created_at) + interval '1 day')::date,
        '2026-05-01'::date
      );
    ELSE
      v_penalty := 0;
      v_start_date := v_end_date + 1;
  END CASE;

  v_penalty := greatest(0, coalesce(v_penalty, 0));

  IF v_penalty > 0 AND v_start_date <= v_end_date THEN
    v_date := v_start_date;
    WHILE v_date <= v_end_date LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.inactive_day_penalties
        WHERE user_id = v_user_id AND day = v_date
      ) THEN
        SELECT COALESCE(
          (SELECT presence_ms FROM public.user_study_day_totals WHERE user_id = v_user_id AND day = v_date),
          0
        ) INTO v_presence;

        IF v_presence < 1800000 THEN
          INSERT INTO public.inactive_day_penalties (user_id, day, penalty_rdm, penalized_at)
          VALUES (v_user_id, v_date, v_penalty, now())
          ON CONFLICT (user_id, day) DO NOTHING;

          v_total_deducted := v_total_deducted + v_penalty;
          v_penalties_applied := v_penalties_applied + 1;
        END IF;
      END IF;

      v_date := v_date + 1;
    END LOOP;

    IF v_total_deducted > 0 THEN
      v_guc_prev := NULLIF(current_setting('app.allow_profile_rdm_mutation', true), '');
      PERFORM set_config('app.allow_profile_rdm_mutation', '1', true);
      UPDATE public.profiles
      SET rdm = greatest(0, rdm - v_total_deducted)
      WHERE id = v_user_id;
      IF v_guc_prev IS NULL THEN
        PERFORM set_config('app.allow_profile_rdm_mutation', '0', true);
      ELSE
        PERFORM set_config('app.allow_profile_rdm_mutation', v_guc_prev, true);
      END IF;
    END IF;
  END IF;

  SELECT COALESCE(
    (SELECT value::integer FROM public.rdm_config WHERE key = 'study_streak_bonus_days'),
    90
  ) INTO v_milestone_days;

  SELECT COALESCE(
    (SELECT value::integer FROM public.rdm_config WHERE key = 'study_streak_bonus_rdm'),
    500
  ) INTO v_milestone_rdm;

  SELECT max(day) INTO v_d_anchor
  FROM public.user_study_day_totals
  WHERE user_id = v_user_id
    AND day <= now()::date
    AND presence_ms >= 1800000;

  IF v_d_anchor IS NOT NULL THEN
    v_streak_val := 0;
    v_date := v_d_anchor;
    LOOP
      EXIT WHEN NOT EXISTS (
        SELECT 1
        FROM public.user_study_day_totals
        WHERE user_id = v_user_id
          AND day = v_date
          AND presence_ms >= 1800000
      );
      v_streak_val := v_streak_val + 1;
      v_date := v_date - 1;
      EXIT WHEN v_streak_val > 10000;
    END LOOP;
    v_streak_start_date := v_date + 1;

    IF v_streak_val >= v_milestone_days THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.study_streak_milestone_claims
        WHERE user_id = v_user_id
          AND streak_start_date = v_streak_start_date
          AND milestone_days = v_milestone_days
      ) THEN
        INSERT INTO public.study_streak_milestone_claims (user_id, streak_start_date, milestone_days, claimed_rdm, claimed_at)
        VALUES (v_user_id, v_streak_start_date, v_milestone_days, v_milestone_rdm, now());

        PERFORM public.add_rdm(v_user_id, v_milestone_rdm);
        v_milestone_credited := true;
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'penalties_applied', v_penalties_applied,
    'total_deducted', v_total_deducted,
    'milestone_credited', v_milestone_credited,
    'current_streak', v_streak_val
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_inactive_day_penalties() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reconcile_inactive_day_penalties() TO authenticated;
