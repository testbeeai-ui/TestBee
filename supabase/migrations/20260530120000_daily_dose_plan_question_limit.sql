-- DailyDose RDM min-question gate follows admin subscription plan keys
-- (e.g. free_trial_daily_dose_questions_per_day = 5), not the legacy play_dailydose_min_questions_for_rdm alone.

CREATE OR REPLACE FUNCTION public.resolve_subscription_plan_key(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN lower(coalesce(p.plan_tier, 'free')) = 'free_trial' THEN 'free_trial'
    WHEN lower(coalesce(p.plan_tier, 'free')) IN ('starter', 'scholar') THEN 'starter'
    WHEN lower(coalesce(p.plan_tier, 'free')) IN ('pro', 'champion', 'pro_plus') THEN 'pro'
    WHEN lower(coalesce(p.plan_tier, 'free')) = 'free'
      AND coalesce(p.free_trial_activated, false) THEN 'free_trial'
    ELSE 'free'
  END
  FROM public.profiles p
  WHERE p.id = p_user_id;
$$;

COMMENT ON FUNCTION public.resolve_subscription_plan_key(uuid) IS
  'Maps profiles.plan_tier (+ free_trial_activated) to subscription config prefix: free_trial | free | starter | pro.';

CREATE OR REPLACE FUNCTION public.submit_daily_gauntlet(
  p_gauntlet_date date,
  p_results jsonb,
  p_domain text DEFAULT 'funbrain'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  r jsonb;
  v_total_ms int := 0;
  v_correct int := 0;
  v_question_id uuid;
  v_ok boolean;
  v_time_ms int;
  v_pool text;
  v_sel int;
  v_n int;
  v_prev_streak int;
  v_last_pair_day date;
  v_new_streak int;
  v_domains int;
  v_rdm_academic int;
  v_rdm_funbrain int;
  v_rdm_streak_7 int;
  v_rdm_streak_30 int;
  v_min_q int;
  v_plan text;
  v_plan_limit int;
  v_global_min int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  v_pool := CASE WHEN p_domain = 'academic' THEN 'academic_gauntlet' ELSE 'funbrain_gauntlet' END;

  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'play_dailydose_academic_rdm'), 15)
  INTO v_rdm_academic;
  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'play_dailydose_funbrain_rdm'), 10)
  INTO v_rdm_funbrain;
  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'play_dual_streak_7_rdm'), 50)
  INTO v_rdm_streak_7;
  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'play_dual_streak_30_rdm'), 200)
  INTO v_rdm_streak_30;
  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'play_dailydose_min_questions_for_rdm'), 10)
  INTO v_global_min;

  SELECT public.resolve_subscription_plan_key(v_user_id) INTO v_plan;

  SELECT COALESCE(
    (SELECT value FROM public.rdm_config WHERE key = v_plan || '_daily_dose_questions_per_day'),
    5
  )
  INTO v_plan_limit;

  IF v_plan_limit < 0 THEN
    v_min_q := LEAST(50, GREATEST(1, v_global_min));
  ELSE
    v_min_q := LEAST(50, GREATEST(1, v_plan_limit));
  END IF;

  v_rdm_academic := GREATEST(1, v_rdm_academic);
  v_rdm_funbrain := GREATEST(1, v_rdm_funbrain);
  v_rdm_streak_7 := GREATEST(1, v_rdm_streak_7);
  v_rdm_streak_30 := GREATEST(1, v_rdm_streak_30);

  v_n := COALESCE(jsonb_array_length(p_results), 0);

  FOR r IN SELECT * FROM jsonb_array_elements(p_results) LOOP
    v_question_id := (r->>'question_id')::uuid;
    v_ok := (r->>'is_correct')::boolean;
    v_time_ms := (r->>'time_taken_ms')::int;
    v_total_ms := v_total_ms + COALESCE(v_time_ms, 0);
    IF v_ok THEN v_correct := v_correct + 1; END IF;

    IF (r ? 'selected_answer_index') AND jsonb_typeof(r->'selected_answer_index') = 'number' THEN
      v_sel := (r->>'selected_answer_index')::int;
    ELSE
      v_sel := NULL;
    END IF;

    PERFORM public.record_play_result(v_question_id, v_ok, v_time_ms, NULL, v_pool, v_sel);
  END LOOP;

  INSERT INTO public.daily_gauntlet_attempts (user_id, gauntlet_date, domain, total_time_ms, correct_count)
  VALUES (v_user_id, p_gauntlet_date, p_domain, v_total_ms, v_correct)
  ON CONFLICT (user_id, gauntlet_date, domain) DO UPDATE SET
    total_time_ms = EXCLUDED.total_time_ms,
    correct_count = EXCLUDED.correct_count,
    completed_at = now();

  IF v_n >= v_min_q THEN
    IF p_domain = 'academic' THEN
      PERFORM public.award_daily_rdm(v_user_id, 'DAILY_DOSE_ACADEMIC', v_rdm_academic);
    ELSE
      PERFORM public.award_daily_rdm(v_user_id, 'DAILY_DOSE_FUNBRAIN', v_rdm_funbrain);
    END IF;
  END IF;

  SELECT COUNT(DISTINCT g.domain)::int
  INTO v_domains
  FROM public.daily_gauntlet_attempts g
  WHERE g.user_id = v_user_id
    AND g.gauntlet_date = p_gauntlet_date;

  IF v_domains = 2 THEN
    SELECT p.daily_dose_streak, p.last_daily_dose_streak_date
    INTO v_prev_streak, v_last_pair_day
    FROM public.profiles p
    WHERE p.id = v_user_id
    FOR UPDATE;

    IF FOUND AND v_last_pair_day IS DISTINCT FROM p_gauntlet_date THEN
      IF v_last_pair_day IS NULL THEN
        v_new_streak := 1;
      ELSIF p_gauntlet_date = v_last_pair_day + 1 THEN
        v_new_streak := COALESCE(v_prev_streak, 0) + 1;
      ELSE
        v_new_streak := 1;
      END IF;

      UPDATE public.profiles p
      SET
        daily_dose_streak = v_new_streak,
        last_daily_dose_streak_date = p_gauntlet_date,
        updated_at = now()
      WHERE p.id = v_user_id;

      IF v_new_streak > 0 AND v_new_streak % 30 = 0 THEN
        PERFORM public.award_daily_rdm(v_user_id, 'DAILY_DOSE_STREAK_30', v_rdm_streak_30);
      ELSIF v_new_streak > 0 AND v_new_streak % 7 = 0 THEN
        PERFORM public.award_daily_rdm(v_user_id, 'DAILY_DOSE_STREAK_7', v_rdm_streak_7);
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'correct_count', v_correct, 'total_time_ms', v_total_ms);
END;
$$;

COMMENT ON FUNCTION public.submit_daily_gauntlet(date, jsonb, text) IS
  'Records DailyDose attempt; RDM min-question gate uses {plan}_daily_dose_questions_per_day from rdm_config (admin subscriptions). Unlimited plans fall back to play_dailydose_min_questions_for_rdm.';
