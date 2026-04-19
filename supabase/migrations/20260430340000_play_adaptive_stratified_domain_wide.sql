-- Stratified domain-wide adaptive pool: balance play_questions.category (Funbrain tabs + PCM)
-- before filling remainder, then shuffle order. Preserves correct-only exclusion and cycle reset.

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
    WITH eligible AS (
      SELECT
        q.id,
        q.content,
        q.options,
        q.correct_answer_index,
        q.explanation,
        q.difficulty_rating,
        q.category,
        row_number() OVER (PARTITION BY q.category ORDER BY random()) AS rn
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
    ),
    cat_list AS (
      SELECT DISTINCT category FROM eligible
    ),
    c_count AS (
      SELECT COUNT(*)::int AS c FROM cat_list
    ),
    per AS (
      SELECT
        CASE WHEN (SELECT c FROM c_count) = 0 THEN 0
             ELSE p_count / (SELECT c FROM c_count) END AS floor_part,
        CASE WHEN (SELECT c FROM c_count) = 0 THEN 0
             ELSE p_count % (SELECT c FROM c_count) END AS rem
    ),
    cat_quota AS (
      SELECT
        cl.category,
        (SELECT floor_part FROM per) + CASE
          WHEN row_number() OVER (ORDER BY random()) <= (SELECT rem FROM per) THEN 1
          ELSE 0
        END AS quota
      FROM cat_list cl
    ),
    first_pick AS (
      SELECT e.id, e.content, e.options, e.correct_answer_index, e.explanation, e.difficulty_rating, e.category
      FROM eligible e
      INNER JOIN cat_quota cq ON cq.category = e.category
      WHERE cq.quota > 0 AND e.rn <= cq.quota
    ),
    deficit AS (
      SELECT GREATEST(0, p_count - (SELECT COUNT(*)::int FROM first_pick)) AS d
    ),
    second_pick AS (
      SELECT e.id, e.content, e.options, e.correct_answer_index, e.explanation, e.difficulty_rating, e.category
      FROM eligible e
      WHERE NOT EXISTS (SELECT 1 FROM first_pick fp WHERE fp.id = e.id)
      ORDER BY random()
      LIMIT (SELECT d FROM deficit)
    ),
    combined AS (
      SELECT fp.id, fp.content, fp.options, fp.correct_answer_index, fp.explanation, fp.difficulty_rating, fp.category, random() AS ord
      FROM first_pick fp
      UNION ALL
      SELECT sp.id, sp.content, sp.options, sp.correct_answer_index, sp.explanation, sp.difficulty_rating, sp.category, random() AS ord
      FROM second_pick sp
    )
    SELECT c.id, c.content, c.options, c.correct_answer_index, c.explanation, c.difficulty_rating, c.category
    FROM combined c
    ORDER BY c.ord
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

COMMENT ON FUNCTION public.get_adaptive_play_questions IS
'Domain-wide (*_all, *_gauntlet): stratified by play_questions.category (Hamilton quotas: floor(N/C) plus remainder spread across random categories), then shuffle; fills shortfall from remaining eligible. Single category: flat random. Excludes correct answers since question_pool_reset_at until pool mastered, then resets.';
