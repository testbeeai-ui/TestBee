-- Student portal automation fixes:
-- time-travel is per student, join codes match case-insensitively,
-- DailyDose pays only for answered questions, feed posts credit RDM once,
-- and authors can edit or delete their own doubts after they are resolved.

UPDATE public.rdm_config
SET value = 0
WHERE key = 'global_time_travel_enabled';

CREATE OR REPLACE FUNCTION public.lookup_classroom_by_join_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_code text;
  v_row public.classrooms%ROWTYPE;
BEGIN
  v_code := upper(regexp_replace(trim(coalesce(p_code, '')), '\s+', '', 'g'));
  IF length(v_code) < 6 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_code');
  END IF;

  SELECT * INTO v_row
  FROM public.classrooms
  WHERE upper(trim(join_code)) = v_code
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'classroom', null);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'classroom', jsonb_build_object(
      'id', v_row.id,
      'name', v_row.name,
      'subject', v_row.subject,
      'section', v_row.section,
      'join_code', v_row.join_code,
      'teacher_id', v_row.teacher_id,
      'description', v_row.description,
      'intro_video_url', v_row.intro_video_url,
      'created_at', v_row.created_at,
      'updated_at', v_row.updated_at,
      'google_meet_link', v_row.google_meet_link,
      'google_recurring_event_id', v_row.google_recurring_event_id,
      'allow_adhoc_trial', v_row.allow_adhoc_trial
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_daily_gauntlet(
  p_gauntlet_date date,
  p_results jsonb,
  p_domain text DEFAULT 'funbrain'::text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  r jsonb;
  v_total_ms int := 0;
  v_correct int := 0;
  v_answered int := 0;
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
    v_ok := COALESCE((r->>'is_correct')::boolean, false);
    v_time_ms := (r->>'time_taken_ms')::int;
    v_total_ms := v_total_ms + COALESCE(v_time_ms, 0);
    IF v_ok THEN v_correct := v_correct + 1; END IF;

    IF (r ? 'selected_answer_index') AND jsonb_typeof(r->'selected_answer_index') = 'number' THEN
      v_sel := (r->>'selected_answer_index')::int;
      v_answered := v_answered + 1;
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

  -- Full-run reward counts answered questions only. A timeout with no picks pays 0.
  IF v_answered >= v_min_q THEN
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

  RETURN jsonb_build_object(
    'ok', true,
    'correct_count', v_correct,
    'answered_count', v_answered,
    'result_count', v_n,
    'total_time_ms', v_total_ms
  );
END;
$$;

CREATE TABLE IF NOT EXISTS public.community_feed_post_rewards (
  post_id uuid PRIMARY KEY REFERENCES public.lessons_raw_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.community_feed_post_rewards ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.claim_community_feed_post_rdm(p_post_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_owner uuid;
  v_kind text;
  v_amount integer;
  v_balance integer;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  SELECT user_id, kind INTO v_owner, v_kind
  FROM public.lessons_raw_posts
  WHERE id = p_post_id;

  IF v_owner IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF v_owner IS DISTINCT FROM v_user THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_owner');
  END IF;
  IF v_kind IS DISTINCT FROM 'post' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_a_feed_post');
  END IF;

  IF EXISTS (SELECT 1 FROM public.community_feed_post_rewards WHERE post_id = p_post_id) THEN
    SELECT rdm INTO v_balance FROM public.profiles WHERE id = v_user;
    RETURN jsonb_build_object(
      'ok', true,
      'already_claimed', true,
      'amount', 0,
      'balance', COALESCE(v_balance, 0)
    );
  END IF;

  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'gyan_post_rdm'), 5)
  INTO v_amount;
  v_amount := GREATEST(0, COALESCE(v_amount, 5));

  INSERT INTO public.community_feed_post_rewards (post_id, user_id, amount)
  VALUES (p_post_id, v_user, v_amount);

  IF v_amount > 0 THEN
    v_balance := public.add_rdm(v_user, v_amount);
  ELSE
    SELECT rdm INTO v_balance FROM public.profiles WHERE id = v_user;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'already_claimed', false,
    'amount', v_amount,
    'balance', COALESCE(v_balance, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_community_feed_post_rdm(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_community_feed_post_rdm(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_community_feed_post_rdm(uuid) TO service_role;

DROP POLICY IF EXISTS "Users can delete own doubts" ON public.doubts;
CREATE POLICY "Users can delete own doubts"
  ON public.doubts
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own doubts" ON public.doubts;
CREATE POLICY "Users can update own doubts"
  ON public.doubts
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
