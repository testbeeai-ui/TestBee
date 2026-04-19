-- Tag play_history with adaptive sentinel (academic_all vs academic_gauntlet, etc.) so DailyDose
-- correct answers do not empty Streak Survival pools — exclusion + domain-wide mastery only count
-- rows whose pool_key matches the requested p_category.

ALTER TABLE public.play_history
  ADD COLUMN IF NOT EXISTS pool_key text;

COMMENT ON COLUMN public.play_history.pool_key IS
  'Adaptive cycle sentinel (e.g. academic_all, academic_gauntlet) when set; used by get_adaptive_play_questions to scope exclusions.';

-- Attribute existing rows to DailyDose / gauntlet-style pools so streak *_all pools are not blocked.
UPDATE public.play_history h
SET pool_key = CASE pq.domain
  WHEN 'academic' THEN 'academic_gauntlet'
  WHEN 'funbrain' THEN 'funbrain_gauntlet'
  ELSE NULL
END
FROM public.play_questions pq
WHERE pq.id = h.question_id
  AND h.pool_key IS NULL;

-- Replace the 4-arg overload; otherwise Postgres keeps both and COMMENT / callers become ambiguous.
DROP FUNCTION IF EXISTS public.record_play_result(uuid, boolean, int, text);

CREATE OR REPLACE FUNCTION public.record_play_result(
  p_question_id uuid,
  p_is_correct boolean,
  p_time_taken_ms int DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_pool_key text DEFAULT NULL
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

  INSERT INTO public.play_history (user_id, question_id, is_correct, time_taken_ms, pool_key)
  VALUES (v_user_id, p_question_id, p_is_correct, p_time_taken_ms, p_pool_key);

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

COMMENT ON FUNCTION public.record_play_result(uuid, boolean, int, text, text) IS
  'play_history always (optional pool_key for adaptive sentinel). user_play_stats Elo/streak for all categories except mental_math.';

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
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  v_pool := CASE WHEN p_domain = 'academic' THEN 'academic_gauntlet' ELSE 'funbrain_gauntlet' END;

  FOR r IN SELECT * FROM jsonb_array_elements(p_results) LOOP
    v_question_id := (r->>'question_id')::uuid;
    v_ok := (r->>'is_correct')::boolean;
    v_time_ms := (r->>'time_taken_ms')::int;
    v_total_ms := v_total_ms + COALESCE(v_time_ms, 0);
    IF v_ok THEN v_correct := v_correct + 1; END IF;
    PERFORM public.record_play_result(v_question_id, v_ok, v_time_ms, NULL, v_pool);
  END LOOP;

  INSERT INTO public.daily_gauntlet_attempts (user_id, gauntlet_date, domain, total_time_ms, correct_count)
  VALUES (v_user_id, p_gauntlet_date, p_domain, v_total_ms, v_correct)
  ON CONFLICT (user_id, gauntlet_date, domain) DO UPDATE SET
    total_time_ms = EXCLUDED.total_time_ms,
    correct_count = EXCLUDED.correct_count,
    completed_at = now();

  RETURN jsonb_build_object('ok', true, 'correct_count', v_correct, 'total_time_ms', v_total_ms);
END;
$$;

-- OUT parameter row type changed (added category); CREATE OR REPLACE cannot alter that.
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
      AND h.created_at >= v_reset
      AND h.pool_key IS NOT DISTINCT FROM p_category;

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
            AND h.pool_key IS NOT DISTINCT FROM p_category
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

COMMENT ON FUNCTION public.get_adaptive_play_questions(text, text, integer) IS
  'Domain-wide (*_all, *_gauntlet): stratified by play_questions.category; excludes correct answers whose pool_key matches p_category since question_pool_reset_at; mastery reset counts same pool_key. Single-category path unchanged.';
