-- Play DailyDose: +15 RDM academic / +10 RDM funbrain (once each per IST day on full submit).
-- Streak: consecutive calendar days (gauntlet_date) where BOTH domains completed same day.
-- Milestones: +50 RDM every 7-day streak (not on multiples of 30), +200 RDM every 30-day streak.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS daily_dose_streak integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_daily_dose_streak_date date;

COMMENT ON COLUMN public.profiles.daily_dose_streak IS
  'Consecutive days (by gauntlet_date) completing BOTH academic and funbrain DailyDose.';
COMMENT ON COLUMN public.profiles.last_daily_dose_streak_date IS
  'Last gauntlet_date when both DailyDoses were completed and streak was advanced (idempotency).';

-- daily_reward_claims: new action types
ALTER TABLE public.daily_reward_claims DROP CONSTRAINT IF EXISTS daily_reward_claims_action_type_check;
ALTER TABLE public.daily_reward_claims
  ADD CONSTRAINT daily_reward_claims_action_type_check
  CHECK (
    action_type IN (
      'ASK',
      'COMMENT',
      'UPVOTE',
      'SAVE',
      'INSTACUE_CREATE',
      'TOPIC_QUIZ_ADVANCED_60',
      'NUMERALS_PACK_COMPLETE',
      'DAILY_DOSE_ACADEMIC',
      'DAILY_DOSE_FUNBRAIN',
      'DAILY_DOSE_STREAK_7',
      'DAILY_DOSE_STREAK_30'
    )
  );

CREATE OR REPLACE FUNCTION public.award_daily_rdm(
  p_user_id uuid,
  p_action_type text,
  p_points integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ist_date date;
  v_claim_id uuid;
  v_new_balance integer;
  v_balance integer;
BEGIN
  IF p_user_id IS NULL OR p_points IS NULL OR p_points <= 0 THEN
    RETURN jsonb_build_object('awarded', false, 'amount', 0, 'balance', NULL, 'reason', 'invalid_params');
  END IF;
  IF p_action_type NOT IN (
    'ASK',
    'COMMENT',
    'UPVOTE',
    'SAVE',
    'INSTACUE_CREATE',
    'TOPIC_QUIZ_ADVANCED_60',
    'NUMERALS_PACK_COMPLETE',
    'DAILY_DOSE_ACADEMIC',
    'DAILY_DOSE_FUNBRAIN',
    'DAILY_DOSE_STREAK_7',
    'DAILY_DOSE_STREAK_30'
  ) THEN
    RETURN jsonb_build_object('awarded', false, 'amount', 0, 'balance', NULL, 'reason', 'invalid_action');
  END IF;
  IF public.is_gyan_bot_user(p_user_id) THEN
    SELECT rdm INTO v_balance FROM public.profiles WHERE id = p_user_id;
    RETURN jsonb_build_object(
      'awarded', false,
      'amount', 0,
      'balance', COALESCE(v_balance, 0),
      'reason', 'gyan_bot'
    );
  END IF;

  v_ist_date := ((now() AT TIME ZONE 'Asia/Kolkata'))::date;

  INSERT INTO public.daily_reward_claims (user_id, action_type, claim_date_ist, points_awarded)
  VALUES (p_user_id, p_action_type, v_ist_date, p_points)
  ON CONFLICT (user_id, action_type, claim_date_ist) DO NOTHING
  RETURNING id INTO v_claim_id;

  IF v_claim_id IS NOT NULL THEN
    v_new_balance := public.add_rdm(p_user_id, p_points);
    RETURN jsonb_build_object(
      'awarded', true,
      'amount', p_points,
      'balance', v_new_balance,
      'claim_date_ist', v_ist_date
    );
  END IF;

  SELECT rdm INTO v_balance FROM public.profiles WHERE id = p_user_id;
  RETURN jsonb_build_object(
    'awarded', false,
    'amount', 0,
    'balance', COALESCE(v_balance, 0),
    'claim_date_ist', v_ist_date,
    'reason', 'already_claimed_today'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.award_daily_rdm(uuid, text, integer) FROM PUBLIC;

COMMENT ON FUNCTION public.award_daily_rdm(uuid, text, integer) IS
  'IST-day-first RDM; includes DailyDose academic/funbrain and streak milestone bonuses.';

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
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  v_pool := CASE WHEN p_domain = 'academic' THEN 'academic_gauntlet' ELSE 'funbrain_gauntlet' END;

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

  -- DailyDose RDM: full session only (matches 10-question adaptive DailyDose).
  IF v_n >= 10 THEN
    IF p_domain = 'academic' THEN
      PERFORM public.award_daily_rdm(v_user_id, 'DAILY_DOSE_ACADEMIC', 15);
    ELSE
      PERFORM public.award_daily_rdm(v_user_id, 'DAILY_DOSE_FUNBRAIN', 10);
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
        PERFORM public.award_daily_rdm(v_user_id, 'DAILY_DOSE_STREAK_30', 200);
      ELSIF v_new_streak > 0 AND v_new_streak % 7 = 0 THEN
        PERFORM public.award_daily_rdm(v_user_id, 'DAILY_DOSE_STREAK_7', 50);
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'correct_count', v_correct, 'total_time_ms', v_total_ms);
END;
$$;

COMMENT ON FUNCTION public.submit_daily_gauntlet(date, jsonb, text) IS
  'Records DailyDose attempt, +15/+10 RDM on full 10-Q submit (IST), advances dual-domain streak when both domains done same gauntlet_date, milestone RDM at 7n (not 30n) and 30n.';

REVOKE ALL ON FUNCTION public.submit_daily_gauntlet(date, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_daily_gauntlet(date, jsonb, text) TO authenticated;
