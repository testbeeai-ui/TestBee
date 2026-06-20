-- Adaptive play: use full category pool for every domain/category (same policy as mental_math).
-- No difficulty_rating band and no exclusion of previously correct answers — continuous flow.
-- user_play_stats (Elo / streak) still updates via record_play_result.

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
BEGIN
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.user_play_stats (user_id, category)
  VALUES (v_user_id, p_category)
  ON CONFLICT (user_id, category) DO NOTHING;

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
'Returns up to p_count random questions from the pool for domain+category. No rating band and no skip for prior correct answers; ratings still move via record_play_result.';
