-- Domain-wide adaptive pools for Streak (academic_all / funbrain_all) and DailyDose
-- (academic_gauntlet / funbrain_gauntlet), separate cycle keys in user_play_stats.
-- Legacy: single real category (physics, verbal, ...) unchanged.
-- Returns category on each row for UI badges.

DROP FUNCTION IF EXISTS public.get_daily_gauntlet_questions(date, text);
DROP FUNCTION IF EXISTS public.get_adaptive_play_questions(text, text, integer);

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
  difficulty_rating integer,
  category text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_reset timestamptz;
  v_pool int;
  v_mastered int;
  v_domain_wide boolean := p_category IN (
    'academic_all', 'funbrain_all', 'academic_gauntlet', 'funbrain_gauntlet'
  );
BEGIN
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  IF v_domain_wide THEN
    IF (p_category IN ('academic_all', 'academic_gauntlet') AND p_domain IS DISTINCT FROM 'academic')
       OR (p_category IN ('funbrain_all', 'funbrain_gauntlet') AND p_domain IS DISTINCT FROM 'funbrain') THEN
      RETURN;
    END IF;
  END IF;

  SELECT s.question_pool_reset_at INTO v_reset
  FROM public.user_play_stats s
  WHERE s.user_id = v_user_id AND s.category = p_category;

  IF NOT FOUND THEN
    INSERT INTO public.user_play_stats (user_id, category, question_pool_reset_at)
    VALUES (v_user_id, p_category, now())
    ON CONFLICT (user_id, category) DO NOTHING;

    SELECT s.question_pool_reset_at INTO v_reset
    FROM public.user_play_stats s
    WHERE s.user_id = v_user_id AND s.category = p_category;
  END IF;

  v_reset := COALESCE(v_reset, now());

  IF v_domain_wide THEN
    SELECT COUNT(*)::int INTO v_pool
    FROM public.play_questions q
    WHERE q.domain = p_domain;

    IF v_pool = 0 THEN
      RETURN;
    END IF;

    SELECT COUNT(DISTINCT h.question_id)::int INTO v_mastered
    FROM public.play_history h
    INNER JOIN public.play_questions pq ON pq.id = h.question_id
    WHERE h.user_id = v_user_id
      AND h.is_correct = true
      AND pq.domain = p_domain
      AND h.created_at >= v_reset;

    IF v_mastered >= v_pool THEN
      UPDATE public.user_play_stats s
      SET question_pool_reset_at = now(),
          updated_at = now()
      WHERE s.user_id = v_user_id AND s.category = p_category;
      v_reset := now();
    END IF;

    RETURN QUERY
    SELECT
      q.id,
      q.content,
      q.options,
      q.correct_answer_index,
      q.explanation,
      q.difficulty_rating,
      q.category
    FROM public.play_questions q
    WHERE q.domain = p_domain
      AND NOT EXISTS (
        SELECT 1
        FROM public.play_history h
        WHERE h.user_id = v_user_id
          AND h.question_id = q.id
          AND h.is_correct = true
          AND h.created_at >= v_reset
      )
    ORDER BY random()
    LIMIT p_count;
    RETURN;
  END IF;

  SELECT COUNT(*)::int INTO v_pool
  FROM public.play_questions q
  WHERE q.domain = p_domain AND q.category = p_category;

  IF v_pool = 0 THEN
    RETURN;
  END IF;

  SELECT COUNT(DISTINCT h.question_id)::int INTO v_mastered
  FROM public.play_history h
  INNER JOIN public.play_questions pq ON pq.id = h.question_id
  WHERE h.user_id = v_user_id
    AND h.is_correct = true
    AND pq.domain = p_domain
    AND pq.category = p_category
    AND h.created_at >= v_reset;

  IF v_mastered >= v_pool THEN
    UPDATE public.user_play_stats s
    SET question_pool_reset_at = now(),
        updated_at = now()
    WHERE s.user_id = v_user_id AND s.category = p_category;
    v_reset := now();
  END IF;

  RETURN QUERY
  SELECT
    q.id,
    q.content,
    q.options,
    q.correct_answer_index,
    q.explanation,
    q.difficulty_rating,
    q.category
  FROM public.play_questions q
  WHERE q.domain = p_domain
    AND q.category = p_category
    AND NOT EXISTS (
      SELECT 1
      FROM public.play_history h
      WHERE h.user_id = v_user_id
        AND h.question_id = q.id
        AND h.is_correct = true
        AND h.created_at >= v_reset
    )
  ORDER BY random()
  LIMIT p_count;
END;
$$;

COMMENT ON FUNCTION public.get_adaptive_play_questions(text, text, integer) IS
'Random pool: (1) domain-wide when p_category is academic_all, funbrain_all, academic_gauntlet, or funbrain_gauntlet (separate cycle keys per sentinel). (2) Else single play_questions.category. Excludes questions answered correctly since question_pool_reset_at for that cycle key until all pool questions mastered, then resets. Returns category for UI.';

CREATE OR REPLACE FUNCTION public.get_daily_gauntlet_questions(p_date date, p_domain text DEFAULT 'funbrain')
RETURNS TABLE(
  id uuid,
  content jsonb,
  options jsonb,
  correct_answer_index integer,
  explanation text,
  difficulty_rating integer,
  category text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- p_date retained for callers; question set is per-user adaptive mixed pool (gauntlet cycle key).
  RETURN QUERY
  SELECT *
  FROM public.get_adaptive_play_questions(
    p_domain,
    CASE WHEN p_domain = 'academic' THEN 'academic_gauntlet' ELSE 'funbrain_gauntlet' END,
    10
  );
END;
$$;

COMMENT ON FUNCTION public.get_daily_gauntlet_questions(date, text) IS
'10 questions: domain-wide adaptive pool using academic_gauntlet / funbrain_gauntlet cycle (separate from streak *_all keys). p_date unused but kept for API compatibility.';
