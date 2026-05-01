-- Persist learner MCQ choice (option index) on each play_history row for admin review.
-- Index matches play_questions.options order at submit time (same as shuffled UI).

ALTER TABLE public.play_history
  ADD COLUMN IF NOT EXISTS selected_answer_index integer;

COMMENT ON COLUMN public.play_history.selected_answer_index IS
  '0-based index into play_questions.options at submit time. NULL for legacy rows, timeouts, or uncaptured attempts.';

DROP FUNCTION IF EXISTS public.record_play_result(uuid, boolean, int, text, text);

CREATE OR REPLACE FUNCTION public.record_play_result(
  p_question_id uuid,
  p_is_correct boolean,
  p_time_taken_ms int DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_pool_key text DEFAULT NULL,
  p_selected_answer_index int DEFAULT NULL
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

  INSERT INTO public.play_history (user_id, question_id, is_correct, time_taken_ms, pool_key, selected_answer_index)
  VALUES (v_user_id, p_question_id, p_is_correct, p_time_taken_ms, p_pool_key, p_selected_answer_index);

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

COMMENT ON FUNCTION public.record_play_result(uuid, boolean, int, text, text, int) IS
  'Inserts play_history (optional selected_answer_index, pool_key); upserts user_play_stats except mental_math.';

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

  RETURN jsonb_build_object('ok', true, 'correct_count', v_correct, 'total_time_ms', v_total_ms);
END;
$$;
