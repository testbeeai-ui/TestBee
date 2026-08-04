-- Per quiz-set / numerals-formula RDM requires ≥60% on that unit (not mere attempt).
-- Overall bonuses already required ≥60%; align per-unit claims with the same bar.

UPDATE public.rdm_config
SET description = 'Lessons/Dive · Quiz set ≥60% RDM (once per set per subtopic)'
WHERE key = 'subtopic_quiz_set_rdm';

UPDATE public.rdm_config
SET description = 'Lessons/Dive · Numerals formula pack ≥60% RDM (once per formula per subtopic)'
WHERE key = 'subtopic_numerals_formula_rdm';

CREATE OR REPLACE FUNCTION public.claim_quiz_set_complete_rdm(
  p_board text,
  p_subject text,
  p_class_level integer,
  p_topic text,
  p_subtopic_name text,
  p_level text,
  p_quiz_set integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_board_n text := public._norm_content_key(p_board);
  v_subject_n text := public._norm_subject_key(p_subject);
  v_topic_n text := public._norm_content_key(p_topic);
  v_sub_n text := public._norm_content_key(p_subtopic_name);
  v_level text := lower(trim(coalesce(p_level, '')));
  v_bits jsonb;
  v_n int;
  v_sig text;
  v_store jsonb;
  v_key text;
  v_att jsonb;
  v_offset int := 0;
  set_idx int;
  slice_len int;
  start_i int;
  end_excl int;
  sa jsonb;
  i int;
  ans_key text;
  tq int;
  tc int;
  tw int;
  sig_stored text;
  v_pct numeric;
  v_reward int;
  v_new_rdm int;
  v_balance int;
  v_rows int := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('awarded', false, 'amount', 0, 'balance', NULL, 'reason', 'not_authenticated');
  END IF;

  IF public.is_gyan_bot_user(v_uid) THEN
    RETURN jsonb_build_object('awarded', false, 'amount', 0, 'balance', NULL, 'reason', 'gyan_bot');
  END IF;

  IF p_class_level IS NULL OR p_class_level NOT IN (11, 12) THEN
    RETURN jsonb_build_object('awarded', false, 'amount', 0, 'balance', NULL, 'reason', 'invalid_class_level');
  END IF;

  IF v_level NOT IN ('basics', 'intermediate', 'advanced') THEN
    RETURN jsonb_build_object('awarded', false, 'amount', 0, 'balance', NULL, 'reason', 'invalid_level');
  END IF;

  IF p_quiz_set IS NULL OR p_quiz_set < 1 OR p_quiz_set > 6 THEN
    RETURN jsonb_build_object('awarded', false, 'amount', 0, 'balance', NULL, 'reason', 'invalid_quiz_set');
  END IF;

  IF v_board_n = '' OR v_subject_n = '' OR v_topic_n = '' OR v_sub_n = '' THEN
    RETURN jsonb_build_object('awarded', false, 'amount', 0, 'balance', NULL, 'reason', 'invalid_scope');
  END IF;

  SELECT sc.bits_questions INTO v_bits
  FROM public.subtopic_content sc
  WHERE sc.board = v_board_n
    AND sc.subject = v_subject_n
    AND sc.class_level = p_class_level
    AND sc.topic = v_topic_n
    AND sc.subtopic_name = v_sub_n
    AND sc.level = v_level
  LIMIT 1;

  IF v_bits IS NULL OR jsonb_typeof(v_bits) <> 'array' THEN
    RETURN jsonb_build_object('awarded', false, 'amount', 0, 'balance', NULL, 'reason', 'content_not_found');
  END IF;

  v_n := jsonb_array_length(v_bits);
  IF v_n <= 0 THEN
    RETURN jsonb_build_object('awarded', false, 'amount', 0, 'balance', NULL, 'reason', 'no_questions');
  END IF;

  v_offset := 0;
  slice_len := 0;
  FOR set_idx IN 1..6 LOOP
    IF set_idx <= 5 THEN
      slice_len := LEAST(5, GREATEST(0, v_n - v_offset));
    ELSE
      slice_len := GREATEST(0, v_n - v_offset);
    END IF;
    IF set_idx = p_quiz_set THEN
      EXIT;
    END IF;
    v_offset := v_offset + slice_len;
  END LOOP;

  IF slice_len <= 0 THEN
    RETURN jsonb_build_object('awarded', false, 'amount', 0, 'balance', NULL, 'reason', 'empty_set');
  END IF;

  start_i := v_offset;
  end_excl := start_i + slice_len;

  v_sig := public.bits_signature_v1(v_bits);
  IF v_sig IS NULL THEN
    RETURN jsonb_build_object('awarded', false, 'amount', 0, 'balance', NULL, 'reason', 'invalid_bits_questions');
  END IF;

  SELECT p.bits_test_attempts INTO v_store
  FROM public.profiles p
  WHERE p.id = v_uid;

  IF v_store IS NULL OR jsonb_typeof(v_store) <> 'object' THEN
    RETURN jsonb_build_object('awarded', false, 'amount', 0, 'balance', NULL, 'reason', 'no_attempts_store');
  END IF;

  v_key := public._bits_attempt_key(p_board, p_subject, p_class_level, p_topic, p_subtopic_name, p_quiz_set);
  v_att := v_store -> v_key;

  IF v_att IS NULL OR jsonb_typeof(v_att) <> 'object' THEN
    RETURN jsonb_build_object('awarded', false, 'amount', 0, 'balance', NULL, 'reason', 'missing_set_attempt');
  END IF;

  sig_stored := COALESCE(v_att ->> 'bitsSignature', '');
  IF sig_stored IS DISTINCT FROM v_sig THEN
    RETURN jsonb_build_object('awarded', false, 'amount', 0, 'balance', NULL, 'reason', 'signature_mismatch');
  END IF;

  tq := COALESCE((v_att ->> 'totalQuestions')::int, -1);
  tc := COALESCE((v_att ->> 'correctCount')::int, -1);
  tw := COALESCE((v_att ->> 'wrongCount')::int, -1);
  IF tq <> slice_len OR tc + tw <> slice_len OR tc < 0 OR tw < 0 THEN
    RETURN jsonb_build_object('awarded', false, 'amount', 0, 'balance', NULL, 'reason', 'incomplete_or_invalid_counts');
  END IF;

  sa := v_att -> 'selectedAnswers';
  IF sa IS NULL OR jsonb_typeof(sa) <> 'object' THEN
    RETURN jsonb_build_object('awarded', false, 'amount', 0, 'balance', NULL, 'reason', 'missing_selected_answers');
  END IF;

  FOR i IN start_i..end_excl - 1 LOOP
    ans_key := i::text;
    IF NOT (sa ? ans_key) THEN
      RETURN jsonb_build_object('awarded', false, 'amount', 0, 'balance', NULL, 'reason', 'missing_answer_index_' || i::text);
    END IF;
  END LOOP;

  v_pct := round((tc::numeric * 100) / NULLIF(tq, 0)::numeric, 2);
  IF v_pct IS NULL OR v_pct < 60 THEN
    SELECT rdm INTO v_balance FROM public.profiles WHERE id = v_uid;
    RETURN jsonb_build_object(
      'awarded', false,
      'amount', 0,
      'balance', COALESCE(v_balance, 0),
      'reason', 'below_threshold',
      'score_pct', COALESCE(v_pct, 0)
    );
  END IF;

  v_reward := GREATEST(1, LEAST(500, COALESCE(
    (SELECT value FROM public.rdm_config WHERE key = 'subtopic_quiz_set_rdm' LIMIT 1), 5)));

  PERFORM pg_advisory_xact_lock(914031, hashtext(v_uid::text || '|' || v_board_n || '|' || v_sub_n || '|qs|' || p_quiz_set::text));

  INSERT INTO public.quiz_set_complete_rdm_claims (
    user_id, board, subject, class_level, topic, subtopic, level, quiz_set, rdm_amount
  ) VALUES (
    v_uid,
    left(v_board_n, 80),
    left(v_subject_n, 80),
    p_class_level,
    left(v_topic_n, 400),
    left(v_sub_n, 400),
    v_level,
    p_quiz_set,
    v_reward
  )
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    SELECT rdm INTO v_balance FROM public.profiles WHERE id = v_uid;
    RETURN jsonb_build_object(
      'awarded', false,
      'amount', 0,
      'balance', COALESCE(v_balance, 0),
      'reason', 'already_claimed_set'
    );
  END IF;

  v_new_rdm := public.add_rdm(v_uid, v_reward);
  RETURN jsonb_build_object(
    'awarded', true,
    'amount', v_reward,
    'balance', v_new_rdm,
    'reason', NULL,
    'quiz_set', p_quiz_set
  );
END;
$$;

COMMENT ON FUNCTION public.claim_quiz_set_complete_rdm(
  text, text, integer, text, text, text, integer
) IS 'Credits subtopic_quiz_set_rdm once per (user, subtopic scope, quiz_set) when that set attempt is ≥60%.';

CREATE OR REPLACE FUNCTION public.claim_numerals_formula_complete_rdm(
  p_board text,
  p_subject text,
  p_class_level integer,
  p_topic text,
  p_subtopic_name text,
  p_level text,
  p_formula_index integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_board_n text := public._norm_content_key(p_board);
  v_subject_n text := public._norm_subject_key(p_subject);
  v_topic_n text := public._norm_content_key(p_topic);
  v_sub_n text := public._norm_content_key(p_subtopic_name);
  v_level text := lower(trim(coalesce(p_level, '')));
  v_formulas jsonb;
  v_elem jsonb;
  v_bq jsonb;
  v_bits jsonb;
  v_key text;
  v_att jsonb;
  v_sig_expected text;
  v_sig_att text;
  sa jsonb;
  qi int;
  ans_key text;
  tq int;
  tc int;
  tw int;
  v_pct numeric;
  v_reward int;
  v_new_rdm int;
  v_balance int;
  v_rows int := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('awarded', false, 'amount', 0, 'balance', NULL, 'reason', 'not_authenticated');
  END IF;

  IF public.is_gyan_bot_user(v_uid) THEN
    RETURN jsonb_build_object('awarded', false, 'amount', 0, 'balance', NULL, 'reason', 'gyan_bot');
  END IF;

  IF p_class_level NOT IN (11, 12) OR v_level NOT IN ('basics', 'intermediate', 'advanced') THEN
    RETURN jsonb_build_object('awarded', false, 'amount', 0, 'balance', NULL, 'reason', 'invalid_scope');
  END IF;

  IF p_formula_index IS NULL OR p_formula_index < 0 THEN
    RETURN jsonb_build_object('awarded', false, 'amount', 0, 'balance', NULL, 'reason', 'invalid_formula_index');
  END IF;

  IF v_board_n = '' OR v_subject_n = '' OR v_topic_n = '' OR v_sub_n = '' THEN
    RETURN jsonb_build_object('awarded', false, 'amount', 0, 'balance', NULL, 'reason', 'invalid_scope');
  END IF;

  SELECT sc.practice_formulas INTO v_formulas
  FROM public.subtopic_content sc
  WHERE sc.board = v_board_n
    AND sc.subject = v_subject_n
    AND sc.class_level = p_class_level
    AND sc.topic = v_topic_n
    AND sc.subtopic_name = v_sub_n
    AND sc.level = v_level
  LIMIT 1;

  IF v_formulas IS NULL OR jsonb_typeof(v_formulas) <> 'array' THEN
    RETURN jsonb_build_object('awarded', false, 'amount', 0, 'balance', NULL, 'reason', 'subtopic_not_found');
  END IF;

  IF p_formula_index >= jsonb_array_length(v_formulas) THEN
    RETURN jsonb_build_object('awarded', false, 'amount', 0, 'balance', NULL, 'reason', 'formula_out_of_range');
  END IF;

  v_elem := v_formulas -> p_formula_index;
  IF v_elem IS NULL OR jsonb_typeof(v_elem) <> 'object' THEN
    RETURN jsonb_build_object('awarded', false, 'amount', 0, 'balance', NULL, 'reason', 'bad_formula');
  END IF;

  v_bq := v_elem -> 'bitsQuestions';
  IF v_bq IS NULL OR jsonb_typeof(v_bq) <> 'array' OR jsonb_array_length(v_bq) <= 0 THEN
    RETURN jsonb_build_object('awarded', false, 'amount', 0, 'balance', NULL, 'reason', 'no_questions_on_formula');
  END IF;

  SELECT COALESCE(p.bits_test_attempts, '{}'::jsonb) INTO v_bits
  FROM public.profiles p
  WHERE p.id = v_uid;

  v_key := public._formula_practice_attempt_key(
    p_board, p_subject, p_class_level, p_topic, p_subtopic_name, p_level, p_formula_index
  );

  IF NOT (v_bits ? v_key) THEN
    RETURN jsonb_build_object('awarded', false, 'amount', 0, 'balance', NULL, 'reason', 'missing_formula_attempt');
  END IF;

  v_att := v_bits -> v_key;
  IF v_att IS NULL OR jsonb_typeof(v_att) <> 'object' THEN
    RETURN jsonb_build_object('awarded', false, 'amount', 0, 'balance', NULL, 'reason', 'bad_attempt_blob');
  END IF;

  v_sig_expected := public.bits_signature_v1(v_bq);
  v_sig_att := v_att ->> 'bitsSignature';
  IF v_sig_att IS DISTINCT FROM v_sig_expected THEN
    RETURN jsonb_build_object('awarded', false, 'amount', 0, 'balance', NULL, 'reason', 'stale_or_mismatch_signature');
  END IF;

  tq := COALESCE((v_att ->> 'totalQuestions')::int, -1);
  tc := COALESCE((v_att ->> 'correctCount')::int, -1);
  tw := COALESCE((v_att ->> 'wrongCount')::int, -1);
  IF tq <> jsonb_array_length(v_bq) OR tc + tw <> tq OR tc < 0 OR tw < 0 THEN
    RETURN jsonb_build_object('awarded', false, 'amount', 0, 'balance', NULL, 'reason', 'incomplete_or_invalid_counts');
  END IF;

  sa := v_att -> 'selectedAnswers';
  IF sa IS NULL OR jsonb_typeof(sa) <> 'object' THEN
    RETURN jsonb_build_object('awarded', false, 'amount', 0, 'balance', NULL, 'reason', 'missing_selected_answers');
  END IF;

  FOR qi IN 0..jsonb_array_length(v_bq) - 1 LOOP
    ans_key := qi::text;
    IF NOT (sa ? ans_key) THEN
      RETURN jsonb_build_object('awarded', false, 'amount', 0, 'balance', NULL, 'reason', 'missing_answer_q_' || ans_key);
    END IF;
  END LOOP;

  v_pct := round((tc::numeric * 100) / NULLIF(tq, 0)::numeric, 2);
  IF v_pct IS NULL OR v_pct < 60 THEN
    SELECT rdm INTO v_balance FROM public.profiles WHERE id = v_uid;
    RETURN jsonb_build_object(
      'awarded', false,
      'amount', 0,
      'balance', COALESCE(v_balance, 0),
      'reason', 'below_threshold',
      'score_pct', COALESCE(v_pct, 0)
    );
  END IF;

  v_reward := GREATEST(1, LEAST(500, COALESCE(
    (SELECT value FROM public.rdm_config WHERE key = 'subtopic_numerals_formula_rdm' LIMIT 1), 5)));

  PERFORM pg_advisory_xact_lock(
    914032,
    hashtext(v_uid::text || '|' || v_board_n || '|' || v_sub_n || '|nf|' || p_formula_index::text)
  );

  INSERT INTO public.numerals_formula_complete_rdm_claims (
    user_id, board, subject, class_level, topic, subtopic, level, formula_index, rdm_amount
  ) VALUES (
    v_uid,
    left(v_board_n, 80),
    left(v_subject_n, 80),
    p_class_level,
    left(v_topic_n, 400),
    left(v_sub_n, 400),
    v_level,
    p_formula_index,
    v_reward
  )
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    SELECT rdm INTO v_balance FROM public.profiles WHERE id = v_uid;
    RETURN jsonb_build_object(
      'awarded', false,
      'amount', 0,
      'balance', COALESCE(v_balance, 0),
      'reason', 'already_claimed_formula'
    );
  END IF;

  v_new_rdm := public.add_rdm(v_uid, v_reward);
  RETURN jsonb_build_object(
    'awarded', true,
    'amount', v_reward,
    'balance', v_new_rdm,
    'reason', NULL,
    'formula_index', p_formula_index
  );
END;
$$;

COMMENT ON FUNCTION public.claim_numerals_formula_complete_rdm(
  text, text, integer, text, text, text, integer
) IS 'Credits subtopic_numerals_formula_rdm once per (user, subtopic scope, formula_index) when that pack attempt is ≥60%.';

-- Claw back formula claims that were awarded below 60% (attempt counts at claim time).
DO $$
DECLARE
  r record;
  v_key text;
  v_att jsonb;
  tq int;
  tc int;
  v_pct numeric;
BEGIN
  FOR r IN
    SELECT c.*
    FROM public.numerals_formula_complete_rdm_claims c
  LOOP
    v_key := public._formula_practice_attempt_key(
      r.board, r.subject, r.class_level, r.topic, r.subtopic, r.level, r.formula_index
    );
    SELECT p.bits_test_attempts -> v_key INTO v_att
    FROM public.profiles p
    WHERE p.id = r.user_id;

    IF v_att IS NULL OR jsonb_typeof(v_att) <> 'object' THEN
      CONTINUE;
    END IF;

    tq := COALESCE((v_att ->> 'totalQuestions')::int, 0);
    tc := COALESCE((v_att ->> 'correctCount')::int, 0);
    IF tq <= 0 THEN
      CONTINUE;
    END IF;
    v_pct := (tc::numeric * 100) / tq::numeric;
    IF v_pct < 60 THEN
      DELETE FROM public.numerals_formula_complete_rdm_claims
      WHERE user_id = r.user_id
        AND board = r.board
        AND subject = r.subject
        AND class_level = r.class_level
        AND topic = r.topic
        AND subtopic = r.subtopic
        AND level = r.level
        AND formula_index = r.formula_index;
      PERFORM public.add_rdm(r.user_id, -r.rdm_amount);
    END IF;
  END LOOP;

  FOR r IN
    SELECT c.*
    FROM public.quiz_set_complete_rdm_claims c
  LOOP
    v_key := public._bits_attempt_key(
      r.board, r.subject, r.class_level, r.topic, r.subtopic, r.quiz_set
    );
    SELECT p.bits_test_attempts -> v_key INTO v_att
    FROM public.profiles p
    WHERE p.id = r.user_id;

    IF v_att IS NULL OR jsonb_typeof(v_att) <> 'object' THEN
      CONTINUE;
    END IF;

    tq := COALESCE((v_att ->> 'totalQuestions')::int, 0);
    tc := COALESCE((v_att ->> 'correctCount')::int, 0);
    IF tq <= 0 THEN
      CONTINUE;
    END IF;
    v_pct := (tc::numeric * 100) / tq::numeric;
    IF v_pct < 60 THEN
      DELETE FROM public.quiz_set_complete_rdm_claims
      WHERE user_id = r.user_id
        AND board = r.board
        AND subject = r.subject
        AND class_level = r.class_level
        AND topic = r.topic
        AND subtopic = r.subtopic
        AND level = r.level
        AND quiz_set = r.quiz_set;
      PERFORM public.add_rdm(r.user_id, -r.rdm_amount);
    END IF;
  END LOOP;
END;
$$;
