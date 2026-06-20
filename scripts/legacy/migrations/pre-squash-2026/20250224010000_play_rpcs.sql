-- Play RPCs: adaptive fetch, record result, daily gauntlet, submit, leaderboard.

-- Get questions adapted to user rating; exclude questions already answered correctly.
CREATE OR REPLACE FUNCTION public.get_adaptive_play_questions(
  p_domain text,
  p_category text,
  p_count int DEFAULT 5
)
RETURNS TABLE(
  id uuid,
  content jsonb,
  options jsonb,
  correct_answer_index integer,
  explanation text,
  difficulty_rating integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_rating int := 1000;
  v_band_low int;
  v_band_high int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT current_rating INTO v_rating
  FROM public.user_play_stats
  WHERE user_id = v_user_id AND user_play_stats.category = p_category;

  IF v_rating IS NULL THEN
    v_rating := 1000;
    INSERT INTO public.user_play_stats (user_id, category)
    VALUES (v_user_id, p_category)
    ON CONFLICT (user_id, category) DO NOTHING;
  END IF;

  v_band_low := GREATEST(100, v_rating - 100);
  v_band_high := LEAST(3000, v_rating + 100);

  RETURN QUERY
  SELECT
    q.id,
    q.content,
    q.options,
    q.correct_answer_index,
    q.explanation,
    q.difficulty_rating
  FROM public.play_questions q
  WHERE q.domain = p_domain
    AND q.category = p_category
    AND q.difficulty_rating BETWEEN v_band_low AND v_band_high
    AND NOT EXISTS (
      SELECT 1 FROM public.play_history h
      WHERE h.user_id = v_user_id AND h.question_id = q.id AND h.is_correct = true
    )
  ORDER BY random()
  LIMIT p_count;
END;
$$;

COMMENT ON FUNCTION public.get_adaptive_play_questions IS 'Returns up to p_count questions in difficulty band; excludes correctly answered.';

-- Record one answer and update user_play_stats (rating + streak).
CREATE OR REPLACE FUNCTION public.record_play_result(
  p_question_id uuid,
  p_is_correct boolean,
  p_time_taken_ms int DEFAULT NULL,
  p_category text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_cat text;
  v_rating int;
  v_streak int;
  v_k int := 32;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  IF p_category IS NULL THEN
    SELECT q.category INTO v_cat FROM public.play_questions q WHERE q.id = p_question_id;
  ELSE
    v_cat := p_category;
  END IF;

  INSERT INTO public.play_history (user_id, question_id, is_correct, time_taken_ms)
  VALUES (v_user_id, p_question_id, p_is_correct, p_time_taken_ms);

  INSERT INTO public.user_play_stats (user_id, category, current_rating, questions_answered, win_streak)
  VALUES (v_user_id, v_cat, 1000, 0, 0)
  ON CONFLICT (user_id, category) DO UPDATE SET
    questions_answered = user_play_stats.questions_answered + 1,
    win_streak = CASE WHEN p_is_correct THEN user_play_stats.win_streak + 1 ELSE 0 END,
    current_rating = GREATEST(100, LEAST(3000,
      user_play_stats.current_rating + (CASE WHEN p_is_correct THEN v_k ELSE -v_k END)
    )),
    updated_at = now();
END;
$$;

COMMENT ON FUNCTION public.record_play_result IS 'Inserts play_history and upserts user_play_stats with Elo step.';

-- Get deterministic daily gauntlet questions (10 funbrain) for a date.
CREATE OR REPLACE FUNCTION public.get_daily_gauntlet_questions(p_date date)
RETURNS TABLE(
  id uuid,
  content jsonb,
  options jsonb,
  correct_answer_index integer,
  explanation text,
  difficulty_rating integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    q.id,
    q.content,
    q.options,
    q.correct_answer_index,
    q.explanation,
    q.difficulty_rating
  FROM public.play_questions q
  WHERE q.domain = 'funbrain'
  ORDER BY md5(q.id::text || p_date::text)
  LIMIT 10;
END;
$$;

COMMENT ON FUNCTION public.get_daily_gauntlet_questions IS 'Returns same 10 funbrain questions for a given date (deterministic).';

-- Submit daily gauntlet attempt (one per user per day).
CREATE OR REPLACE FUNCTION public.submit_daily_gauntlet(
  p_gauntlet_date date,
  p_results jsonb
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
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  FOR r IN SELECT * FROM jsonb_array_elements(p_results)
  LOOP
    v_question_id := (r->>'question_id')::uuid;
    v_ok := (r->>'is_correct')::boolean;
    v_time_ms := (r->>'time_taken_ms')::int;
    v_total_ms := v_total_ms + COALESCE(v_time_ms, 0);
    IF v_ok THEN v_correct := v_correct + 1; END IF;
    PERFORM public.record_play_result(v_question_id, v_ok, v_time_ms, NULL);
  END LOOP;

  INSERT INTO public.daily_gauntlet_attempts (user_id, gauntlet_date, total_time_ms, correct_count)
  VALUES (v_user_id, p_gauntlet_date, v_total_ms, v_correct)
  ON CONFLICT (user_id, gauntlet_date) DO UPDATE SET
    total_time_ms = EXCLUDED.total_time_ms,
    correct_count = EXCLUDED.correct_count,
    completed_at = now();

  RETURN jsonb_build_object('ok', true, 'correct_count', v_correct, 'total_time_ms', v_total_ms);
END;
$$;

COMMENT ON FUNCTION public.submit_daily_gauntlet IS 'Records gauntlet attempt; p_results is array of { question_id, is_correct, time_taken_ms }.';

-- Leaderboard for a gauntlet date: fastest first, then by correct count.
CREATE OR REPLACE FUNCTION public.get_daily_gauntlet_leaderboard(p_gauntlet_date date)
RETURNS TABLE(
  rank bigint,
  user_id uuid,
  display_name text,
  correct_count integer,
  total_time_ms integer,
  completed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    row_number() OVER (ORDER BY g.correct_count DESC, g.total_time_ms ASC)::bigint AS rank,
    g.user_id,
    p.name AS display_name,
    g.correct_count,
    g.total_time_ms,
    g.completed_at
  FROM public.daily_gauntlet_attempts g
  LEFT JOIN public.profiles p ON p.id = g.user_id
  WHERE g.gauntlet_date = p_gauntlet_date
  ORDER BY g.correct_count DESC, g.total_time_ms ASC;
END;
$$;

COMMENT ON FUNCTION public.get_daily_gauntlet_leaderboard IS 'Leaderboard for a date: by correct count desc, then time asc.';
