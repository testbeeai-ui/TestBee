-- Funbrain (all categories): same flow as Mental Math for *questions* —
-- only questions not yet answered in the current cycle (any result), then
-- clear this user's play_history for that funbrain category when the pool is exhausted.
-- Academic modes unchanged (flat random, no cycle delete).
-- record_play_result unchanged here: mental_math still skips Elo; other funbrain categories still update Elo.

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

  IF p_domain = 'funbrain' THEN
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
        AND q.category = p_category;
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
'Funbrain: per-category unanswered-only until pool exhausted, then that category''s play_history rows for the user are cleared and the bank repeats. Academic: flat random from pool.';
