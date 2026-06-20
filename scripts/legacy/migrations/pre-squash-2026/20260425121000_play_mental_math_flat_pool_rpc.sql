-- Mental Math: full question bank always eligible (no Elo band on rows, no "answered correct" exclusion).
-- Per-question difficulty_rating is normalized to 1000 — global Funbrain ELO / streak still update via record_play_result.

UPDATE public.play_questions
SET difficulty_rating = 1000
WHERE domain = 'funbrain' AND category = 'mental_math';

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
  v_flat_pool boolean;
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

  v_flat_pool := p_domain = 'funbrain' AND p_category = 'mental_math';

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
    AND (
      v_flat_pool
      OR q.difficulty_rating BETWEEN v_band_low AND v_band_high
    )
    AND (
      v_flat_pool
      OR NOT EXISTS (
        SELECT 1 FROM public.play_history h
        WHERE h.user_id = v_user_id AND h.question_id = q.id AND h.is_correct = true
      )
    )
  ORDER BY random()
  LIMIT p_count;
END;
$$;

COMMENT ON FUNCTION public.get_adaptive_play_questions IS
'Returns up to p_count questions; funbrain/mental_math uses full pool (no row rating band, repeats allowed). Other categories use difficulty_rating band and exclude prior correct answers.';
