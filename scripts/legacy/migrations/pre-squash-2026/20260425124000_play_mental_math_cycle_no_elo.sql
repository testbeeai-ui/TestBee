-- Mental Math (funbrain/mental_math):
-- 1) get_adaptive_play_questions: serve only questions not yet answered in this cycle (any result).
--    When none left, delete that user's play_history for mental_math only → full bank available again.
-- 2) record_play_result: for mental_math, only append play_history; do not change user_play_stats (Elo/streak).

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
  v_pool int;
  v_remaining int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.user_play_stats (user_id, category)
  VALUES (v_user_id, p_category)
  ON CONFLICT (user_id, category) DO NOTHING;

  IF p_domain = 'funbrain' AND p_category = 'mental_math' THEN
    SELECT COUNT(*) INTO v_pool
    FROM public.play_questions q
    WHERE q.domain = p_domain AND q.category = p_category;

    SELECT COUNT(*) INTO v_remaining
    FROM public.play_questions q
    WHERE q.domain = p_domain AND q.category = p_category
      AND NOT EXISTS (
        SELECT 1 FROM public.play_history h
        WHERE h.user_id = v_user_id AND h.question_id = q.id
      );

    IF v_pool > 0 AND v_remaining = 0 THEN
      DELETE FROM public.play_history h
      USING public.play_questions q
      WHERE h.user_id = v_user_id
        AND h.question_id = q.id
        AND q.domain = 'funbrain'
        AND q.category = 'mental_math';
    END IF;

    RETURN QUERY
    SELECT
      q2.id,
      q2.content,
      q2.options,
      q2.correct_answer_index,
      q2.explanation,
      q2.difficulty_rating
    FROM public.play_questions q2
    WHERE q2.domain = p_domain
      AND q2.category = p_category
      AND NOT EXISTS (
        SELECT 1 FROM public.play_history h2
        WHERE h2.user_id = v_user_id AND h2.question_id = q2.id
      )
    ORDER BY random()
    LIMIT p_count;

    RETURN;
  END IF;

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
  ORDER BY random()
  LIMIT p_count;
END;
$$;

COMMENT ON FUNCTION public.get_adaptive_play_questions IS
'Mental math: unanswered-only until pool exhausted, then play_history for that category is cleared for the user. Other categories: flat random.';

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

  IF v_cat = 'mental_math' THEN
    RETURN;
  END IF;

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

COMMENT ON FUNCTION public.record_play_result IS
'play_history always. user_play_stats Elo/streak for all categories except mental_math (display-only pool).';
