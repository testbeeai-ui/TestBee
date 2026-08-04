-- Cross-subtopic claim reliability:
-- Claim RPCs previously read only profiles.bits_test_attempts JSON.
-- Rapid subtopic switches can lose keys in that JSON (read-modify-write races),
-- while student_bits_attempts already has the durable per-key row.
-- Prefer the table; fall back to profile JSON. Scope advisory locks by topic+level.

CREATE OR REPLACE FUNCTION public._student_bits_attempt(
  p_uid uuid,
  p_attempt_key text
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_att jsonb;
BEGIN
  IF p_uid IS NULL OR coalesce(nullif(btrim(p_attempt_key), ''), '') = '' THEN
    RETURN NULL;
  END IF;

  SELECT s.attempt
  INTO v_att
  FROM public.student_bits_attempts s
  WHERE s.user_id = p_uid
    AND s.attempt_key = p_attempt_key
  LIMIT 1;

  IF v_att IS NOT NULL AND jsonb_typeof(v_att) = 'object' THEN
    RETURN v_att;
  END IF;

  SELECT p.bits_test_attempts -> p_attempt_key
  INTO v_att
  FROM public.profiles p
  WHERE p.id = p_uid;

  IF v_att IS NOT NULL AND jsonb_typeof(v_att) = 'object' THEN
    RETURN v_att;
  END IF;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public._student_bits_attempt(uuid, text) IS
  'Resolve a bits/formula attempt: student_bits_attempts first, then profiles.bits_test_attempts.';

REVOKE ALL ON FUNCTION public._student_bits_attempt(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._student_bits_attempt(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public._student_bits_attempt(uuid, text) TO service_role;

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

  -- Product rule: +N only on set 1 (≥60%.
  IF p_quiz_set <> 1 THEN
    SELECT rdm INTO v_balance FROM public.profiles WHERE id = v_uid;
    RETURN jsonb_build_object(
      'awarded', false,
      'amount', 0,
      'balance', COALESCE(v_balance, 0),
      'reason', 'not_first_set'
    );
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

  v_key := public._bits_attempt_key(
    p_board, p_subject, p_class_level, p_topic, p_subtopic_name, p_quiz_set
  );
  v_att := public._student_bits_attempt(v_uid, v_key);

  IF v_att IS NULL THEN
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
      RETURN jsonb_build_object(
        'awarded', false,
        'amount', 0,
        'balance', NULL,
        'reason', 'missing_answer_index_' || i::text
      );
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

  PERFORM pg_advisory_xact_lock(
    914031,
    hashtext(
      v_uid::text || '|' || v_board_n || '|' || v_topic_n || '|' || v_sub_n || '|' ||
      v_level || '|qs|' || p_quiz_set::text
    )
  );

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
) IS 'Credits subtopic_quiz_set_rdm once per (user, subtopic scope) for set 1 ≥60%. Reads student_bits_attempts first.';

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
  v_first int := NULL;
  v_i int;
  v_tmp jsonb;
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

  FOR v_i IN 0..jsonb_array_length(v_formulas) - 1 LOOP
    v_tmp := (v_formulas -> v_i) -> 'bitsQuestions';
    IF v_tmp IS NOT NULL AND jsonb_typeof(v_tmp) = 'array' AND jsonb_array_length(v_tmp) > 0 THEN
      v_first := v_i;
      EXIT;
    END IF;
  END LOOP;

  IF v_first IS NULL THEN
    RETURN jsonb_build_object('awarded', false, 'amount', 0, 'balance', NULL, 'reason', 'no_questions_on_formula');
  END IF;

  -- Product rule: +N only on the first formula pack that has questions.
  IF p_formula_index <> v_first THEN
    SELECT rdm INTO v_balance FROM public.profiles WHERE id = v_uid;
    RETURN jsonb_build_object(
      'awarded', false,
      'amount', 0,
      'balance', COALESCE(v_balance, 0),
      'reason', 'not_first_formula'
    );
  END IF;

  v_elem := v_formulas -> p_formula_index;
  IF v_elem IS NULL OR jsonb_typeof(v_elem) <> 'object' THEN
    RETURN jsonb_build_object('awarded', false, 'amount', 0, 'balance', NULL, 'reason', 'bad_formula');
  END IF;

  v_bq := v_elem -> 'bitsQuestions';
  IF v_bq IS NULL OR jsonb_typeof(v_bq) <> 'array' OR jsonb_array_length(v_bq) <= 0 THEN
    RETURN jsonb_build_object('awarded', false, 'amount', 0, 'balance', NULL, 'reason', 'no_questions_on_formula');
  END IF;

  v_key := public._formula_practice_attempt_key(
    p_board, p_subject, p_class_level, p_topic, p_subtopic_name, p_level, p_formula_index
  );
  v_att := public._student_bits_attempt(v_uid, v_key);

  IF v_att IS NULL THEN
    RETURN jsonb_build_object('awarded', false, 'amount', 0, 'balance', NULL, 'reason', 'missing_formula_attempt');
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
      RETURN jsonb_build_object(
        'awarded', false,
        'amount', 0,
        'balance', NULL,
        'reason', 'missing_answer_q_' || ans_key
      );
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
    hashtext(
      v_uid::text || '|' || v_board_n || '|' || v_topic_n || '|' || v_sub_n || '|' ||
      v_level || '|nf|' || p_formula_index::text
    )
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
) IS 'Credits subtopic_numerals_formula_rdm once per subtopic for first pack ≥60%. Reads student_bits_attempts first.';

CREATE OR REPLACE FUNCTION public.claim_topic_quiz_advanced_daily_rdm(
  p_board text,
  p_subject text,
  p_class_level integer,
  p_topic text,
  p_subtopic_name text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ist date := (timezone('Asia/Kolkata', clock_timestamp()))::date;
  v_board_n text := public._norm_content_key(p_board);
  v_subject_n text := public._norm_subject_key(p_subject);
  v_topic_n text := public._norm_content_key(p_topic);
  v_sub_n text := public._norm_content_key(p_subtopic_name);
  v_topic_legacy text := public._legacy_sanitize_lookup(p_topic);
  v_sub_legacy text := public._legacy_sanitize_lookup(p_subtopic_name);
  v_bits jsonb;
  v_n int;
  v_sig text;
  set_idx int;
  start_i int;
  end_excl int;
  slice_len int;
  v_offset int := 0;
  att jsonb;
  k text;
  i int;
  q jsonb;
  opts jsonb;
  si int;
  chosen text;
  ca text;
  corr int := 0;
  tot int := 0;
  sa jsonb;
  key text;
  v_pct int;
  v_denial text;
  v_quiz_passed boolean := false;
  v_rdm int := 0;
  tc int;
  tw int;
  tq int;
  sig_stored text;
  v_audit_id uuid;
  v_balance int;
  v_out jsonb := NULL;
  v_quiz_rdm int;
  v_new_rdm int;
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

  IF v_board_n = '' OR v_subject_n = '' OR v_topic_n = '' OR v_sub_n = '' THEN
    RETURN jsonb_build_object('awarded', false, 'amount', 0, 'balance', NULL, 'reason', 'invalid_scope');
  END IF;

  INSERT INTO public.topic_quiz_advanced_rdm_attempts (
    user_id, ist_claim_date, board, subject, class_level, topic, subtopic_name,
    eligible, denial_reason, rdm_awarded
  ) VALUES (
    v_uid, v_ist, left(v_board_n, 80), left(v_subject_n, 80), p_class_level,
    left(v_topic_n, 400), left(v_sub_n, 400), false, 'in_progress', 0
  )
  RETURNING id INTO v_audit_id;

  v_denial := NULL;

  SELECT sc.bits_questions INTO v_bits
  FROM public.subtopic_content sc
  WHERE sc.board = v_board_n
    AND sc.subject = v_subject_n
    AND sc.class_level = p_class_level
    AND sc.topic = v_topic_n
    AND sc.subtopic_name = v_sub_n
    AND sc.level = 'advanced'
  LIMIT 1;

  IF v_bits IS NULL AND (v_topic_legacy <> v_topic_n OR v_sub_legacy <> v_sub_n) THEN
    SELECT sc.bits_questions INTO v_bits
    FROM public.subtopic_content sc
    WHERE sc.board = v_board_n
      AND sc.subject = v_subject_n
      AND sc.class_level = p_class_level
      AND sc.topic = v_topic_legacy
      AND sc.subtopic_name = v_sub_legacy
      AND sc.level = 'advanced'
    LIMIT 1;
  END IF;

  IF v_bits IS NULL OR jsonb_typeof(v_bits) <> 'array' THEN
    v_denial := 'content_not_found';
  ELSE
    v_n := jsonb_array_length(v_bits);
    IF v_n <= 5 THEN
      v_denial := 'not_multiset_advanced';
    END IF;
  END IF;

  IF v_denial IS NULL THEN
    v_sig := public.bits_signature_v1(v_bits);
    IF v_sig IS NULL THEN
      v_denial := 'invalid_bits_questions';
    END IF;
  END IF;

  IF v_denial IS NULL THEN
    v_offset := 0;
    <<missing_loop>>
    FOR set_idx IN 1..6 LOOP
      IF set_idx <= 5 THEN
        slice_len := LEAST(5, GREATEST(0, v_n - v_offset));
      ELSE
        slice_len := GREATEST(0, v_n - v_offset);
      END IF;

      IF slice_len <= 0 THEN
        CONTINUE;
      END IF;

      k := public._bits_attempt_key(p_board, p_subject, p_class_level, p_topic, p_subtopic_name, set_idx);
      att := public._student_bits_attempt(v_uid, k);
      IF att IS NULL THEN
        v_denial := 'missing_set_' || set_idx::text;
        EXIT missing_loop;
      END IF;

      v_offset := v_offset + slice_len;
    END LOOP;
  END IF;

  IF v_denial IS NULL THEN
    v_offset := 0;
    <<set_loop>>
    FOR set_idx IN 1..6 LOOP
      IF set_idx <= 5 THEN
        slice_len := LEAST(5, GREATEST(0, v_n - v_offset));
      ELSE
        slice_len := GREATEST(0, v_n - v_offset);
      END IF;

      IF slice_len <= 0 THEN
        CONTINUE;
      END IF;

      start_i := v_offset;
      end_excl := start_i + slice_len;

      k := public._bits_attempt_key(p_board, p_subject, p_class_level, p_topic, p_subtopic_name, set_idx);
      att := public._student_bits_attempt(v_uid, k);

      sig_stored := COALESCE(att ->> 'bitsSignature', '');
      IF sig_stored IS DISTINCT FROM v_sig THEN
        v_denial := 'signature_mismatch_set_' || set_idx::text;
        EXIT set_loop;
      END IF;

      tq := COALESCE((att ->> 'totalQuestions')::int, -1);
      tc := COALESCE((att ->> 'correctCount')::int, -1);
      tw := COALESCE((att ->> 'wrongCount')::int, -1);
      IF tq <> slice_len OR tc + tw <> slice_len OR tc < 0 OR tw < 0 THEN
        v_denial := 'incomplete_or_invalid_counts_set_' || set_idx::text;
        EXIT set_loop;
      END IF;

      sa := att -> 'selectedAnswers';
      IF sa IS NULL OR jsonb_typeof(sa) <> 'object' THEN
        v_denial := 'missing_selected_answers_set_' || set_idx::text;
        EXIT set_loop;
      END IF;

      FOR i IN start_i..end_excl - 1 LOOP
        key := i::text;
        IF NOT (sa ? key) THEN
          v_denial := 'missing_answer_index_' || i::text;
          EXIT set_loop;
        END IF;

        si := (sa ->> key)::int;
        IF si IS NULL OR si < 0 OR si > 3 THEN
          v_denial := 'invalid_answer_index_' || i::text;
          EXIT set_loop;
        END IF;

        q := v_bits -> i;
        IF q IS NULL OR jsonb_typeof(q) <> 'object' THEN
          v_denial := 'missing_question_' || i::text;
          EXIT set_loop;
        END IF;

        opts := q -> 'options';
        IF opts IS NULL OR jsonb_typeof(opts) <> 'array' OR si >= jsonb_array_length(opts) THEN
          v_denial := 'invalid_options_' || i::text;
          EXIT set_loop;
        END IF;

        chosen := (opts -> si) #>> '{}';
        ca := COALESCE(q ->> 'correctAnswer', '');
        tot := tot + 1;
        IF chosen IS NOT DISTINCT FROM ca THEN
          corr := corr + 1;
        END IF;
      END LOOP;

      v_offset := v_offset + slice_len;
    END LOOP;
  END IF;

  IF v_denial IS NULL AND tot <= 0 THEN
    v_denial := 'nothing_graded';
  END IF;

  IF v_denial IS NULL THEN
    v_pct := round(100.0 * corr::numeric / tot::numeric)::int;
    IF v_pct < 60 THEN
      v_denial := 'below_threshold';
    END IF;
  END IF;

  IF v_denial IS NULL THEN
    v_quiz_passed := true;
    v_quiz_rdm := GREATEST(1, LEAST(500, COALESCE(
      (SELECT value FROM public.rdm_config WHERE key = 'subtopic_quiz_advanced_rdm' LIMIT 1), 15)));

    PERFORM pg_advisory_xact_lock(
      914033,
      hashtext(v_uid::text || '|' || v_board_n || '|' || v_topic_n || '|' || v_sub_n || '|qo')
    );

    INSERT INTO public.quiz_overall_complete_rdm_claims (
      user_id, board, subject, class_level, topic, subtopic,
      rdm_amount, score_percent, correct_count, total_questions
    ) VALUES (
      v_uid, left(v_board_n, 80), left(v_subject_n, 80), p_class_level,
      left(v_topic_n, 400), left(v_sub_n, 400),
      v_quiz_rdm, v_pct, corr, tot
    )
    ON CONFLICT DO NOTHING;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows > 0 THEN
      v_new_rdm := public.add_rdm(v_uid, v_quiz_rdm);
      v_rdm := v_quiz_rdm;
      v_out := jsonb_build_object(
        'awarded', true, 'amount', v_quiz_rdm, 'balance', v_new_rdm, 'reason', NULL,
        'score_percent', v_pct, 'correct', corr, 'total', tot
      );
    ELSE
      v_denial := 'already_claimed_subtopic';
      SELECT rdm INTO v_balance FROM public.profiles WHERE id = v_uid;
      v_out := jsonb_build_object(
        'awarded', false, 'amount', 0, 'balance', COALESCE(v_balance, 0),
        'reason', v_denial, 'score_percent', v_pct, 'correct', corr, 'total', tot
      );
    END IF;
  END IF;

  IF v_audit_id IS NOT NULL THEN
    UPDATE public.topic_quiz_advanced_rdm_attempts
    SET
      eligible = v_quiz_passed,
      score_percent = CASE WHEN tot > 0 THEN v_pct ELSE NULL END,
      correct_count = CASE WHEN tot > 0 THEN corr ELSE NULL END,
      total_questions = CASE WHEN tot > 0 THEN tot ELSE NULL END,
      denial_reason = CASE WHEN v_rdm > 0 THEN NULL ELSE v_denial END,
      rdm_awarded = v_rdm
    WHERE id = v_audit_id;
  END IF;

  IF v_out IS NOT NULL THEN
    RETURN v_out;
  END IF;

  SELECT rdm INTO v_balance FROM public.profiles WHERE id = v_uid;
  RETURN jsonb_build_object(
    'awarded', false,
    'amount', 0,
    'balance', COALESCE(v_balance, 0),
    'reason', COALESCE(v_denial, 'not_eligible'),
    'score_percent', CASE WHEN tot > 0 THEN v_pct ELSE NULL END,
    'correct', CASE WHEN tot > 0 THEN corr ELSE NULL END,
    'total', CASE WHEN tot > 0 THEN tot ELSE NULL END
  );
END;
$$;

COMMENT ON FUNCTION public.claim_topic_quiz_advanced_daily_rdm(
  text, text, integer, text, text
) IS 'Overall quiz ≥60% once per subtopic. Reads student_bits_attempts first.';

CREATE OR REPLACE FUNCTION public.claim_numerals_pack_complete_daily_rdm(
  p_board text,
  p_subject text,
  p_class_level integer,
  p_topic text,
  p_subtopic_name text,
  p_level text
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
  v_key text;
  v_sig_expected text;
  v_sig_att text;
  v_i int;
  v_n int;
  v_required int := 0;
  v_att jsonb;
  v_balance integer;
  v_corr int := 0;
  v_tot int := 0;
  v_pct int;
  sa jsonb;
  qi int;
  q jsonb;
  opts jsonb;
  si int;
  chosen text;
  ca text;
  ans_key text;
  v_reward int;
  v_new_rdm int;
  v_rows int := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('awarded', false, 'amount', 0, 'balance', NULL, 'reason', 'unauthenticated');
  END IF;

  IF p_class_level NOT IN (11, 12) OR v_level NOT IN ('basics', 'intermediate', 'advanced') THEN
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
    SELECT sc.practice_formulas INTO v_formulas
    FROM public.subtopic_content sc
    WHERE lower(trim(sc.board)) = lower(trim(p_board))
      AND lower(trim(sc.subject)) = lower(trim(p_subject))
      AND sc.class_level = p_class_level
      AND lower(trim(sc.topic)) = lower(trim(p_topic))
      AND lower(trim(sc.subtopic_name)) = lower(trim(p_subtopic_name))
      AND lower(trim(sc.level)) = v_level
    LIMIT 1;
  END IF;

  IF v_formulas IS NULL OR jsonb_typeof(v_formulas) <> 'array' THEN
    RETURN jsonb_build_object('awarded', false, 'amount', 0, 'balance', NULL, 'reason', 'subtopic_not_found');
  END IF;

  v_n := jsonb_array_length(v_formulas);
  IF v_n <= 0 THEN
    RETURN jsonb_build_object('awarded', false, 'amount', 0, 'balance', NULL, 'reason', 'no_formulas');
  END IF;

  FOR v_i IN 0..v_n - 1 LOOP
    v_elem := v_formulas -> v_i;
    IF v_elem IS NULL OR jsonb_typeof(v_elem) <> 'object' THEN
      CONTINUE;
    END IF;

    v_bq := v_elem -> 'bitsQuestions';
    IF v_bq IS NULL OR jsonb_typeof(v_bq) <> 'array' OR jsonb_array_length(v_bq) <= 0 THEN
      CONTINUE;
    END IF;

    v_required := v_required + 1;

    v_key := public._formula_practice_attempt_key(
      p_board, p_subject, p_class_level, p_topic, p_subtopic_name, p_level, v_i
    );

    v_att := public._student_bits_attempt(v_uid, v_key);
    IF v_att IS NULL THEN
      SELECT rdm INTO v_balance FROM public.profiles WHERE id = v_uid;
      RETURN jsonb_build_object(
        'awarded', false, 'amount', 0, 'balance', COALESCE(v_balance, 0),
        'reason', 'incomplete_numerals'
      );
    END IF;

    v_sig_expected := public.bits_signature_v1(v_bq);
    v_sig_att := v_att ->> 'bitsSignature';
    IF v_sig_att IS DISTINCT FROM v_sig_expected THEN
      SELECT rdm INTO v_balance FROM public.profiles WHERE id = v_uid;
      RETURN jsonb_build_object(
        'awarded', false, 'amount', 0, 'balance', COALESCE(v_balance, 0),
        'reason', 'stale_or_mismatch_signature'
      );
    END IF;

    sa := v_att -> 'selectedAnswers';
    IF sa IS NULL OR jsonb_typeof(sa) <> 'object' THEN
      SELECT rdm INTO v_balance FROM public.profiles WHERE id = v_uid;
      RETURN jsonb_build_object(
        'awarded', false, 'amount', 0, 'balance', COALESCE(v_balance, 0),
        'reason', 'missing_selected_answers_formula_' || v_i::text
      );
    END IF;

    FOR qi IN 0..jsonb_array_length(v_bq) - 1 LOOP
      ans_key := qi::text;
      IF NOT (sa ? ans_key) THEN
        SELECT rdm INTO v_balance FROM public.profiles WHERE id = v_uid;
        RETURN jsonb_build_object(
          'awarded', false, 'amount', 0, 'balance', COALESCE(v_balance, 0),
          'reason', 'missing_answer_formula_' || v_i::text || '_q_' || ans_key
        );
      END IF;

      si := (sa ->> ans_key)::int;
      IF si IS NULL OR si < 0 OR si > 3 THEN
        SELECT rdm INTO v_balance FROM public.profiles WHERE id = v_uid;
        RETURN jsonb_build_object(
          'awarded', false, 'amount', 0, 'balance', COALESCE(v_balance, 0),
          'reason', 'invalid_answer_index_formula_' || v_i::text || '_q_' || ans_key
        );
      END IF;

      q := v_bq -> qi;
      IF q IS NULL OR jsonb_typeof(q) <> 'object' THEN
        SELECT rdm INTO v_balance FROM public.profiles WHERE id = v_uid;
        RETURN jsonb_build_object(
          'awarded', false, 'amount', 0, 'balance', COALESCE(v_balance, 0),
          'reason', 'missing_question_formula_' || v_i::text || '_q_' || ans_key
        );
      END IF;

      opts := q -> 'options';
      IF opts IS NULL OR jsonb_typeof(opts) <> 'array' OR si >= jsonb_array_length(opts) THEN
        SELECT rdm INTO v_balance FROM public.profiles WHERE id = v_uid;
        RETURN jsonb_build_object(
          'awarded', false, 'amount', 0, 'balance', COALESCE(v_balance, 0),
          'reason', 'invalid_options_formula_' || v_i::text || '_q_' || ans_key
        );
      END IF;

      chosen := (opts -> si) #>> '{}';
      ca := COALESCE(q ->> 'correctAnswer', '');
      v_tot := v_tot + 1;
      IF chosen IS NOT DISTINCT FROM ca THEN
        v_corr := v_corr + 1;
      END IF;
    END LOOP;
  END LOOP;

  IF v_required <= 0 THEN
    RETURN jsonb_build_object('awarded', false, 'amount', 0, 'balance', NULL, 'reason', 'no_numerals_required');
  END IF;

  IF v_tot <= 0 THEN
    SELECT rdm INTO v_balance FROM public.profiles WHERE id = v_uid;
    RETURN jsonb_build_object(
      'awarded', false, 'amount', 0, 'balance', COALESCE(v_balance, 0), 'reason', 'nothing_graded'
    );
  END IF;

  v_pct := round(100.0 * v_corr::numeric / v_tot::numeric)::int;
  IF v_pct < 60 THEN
    SELECT rdm INTO v_balance FROM public.profiles WHERE id = v_uid;
    RETURN jsonb_build_object(
      'awarded', false, 'amount', 0, 'balance', COALESCE(v_balance, 0),
      'reason', 'below_threshold', 'score_percent', v_pct, 'correct', v_corr, 'total', v_tot
    );
  END IF;

  v_reward := GREATEST(1, LEAST(500, COALESCE(
    (SELECT value FROM public.rdm_config WHERE key = 'subtopic_numerals_pack_rdm' LIMIT 1), 20)));

  PERFORM pg_advisory_xact_lock(
    914034,
    hashtext(
      v_uid::text || '|' || v_board_n || '|' || v_topic_n || '|' || v_sub_n || '|' || v_level || '|np'
    )
  );

  INSERT INTO public.numerals_pack_complete_rdm_claims (
    user_id, board, subject, class_level, topic, subtopic, level,
    rdm_amount, score_percent, correct_count, total_questions
  ) VALUES (
    v_uid,
    left(COALESCE(NULLIF(v_board_n, ''), lower(trim(p_board))), 80),
    left(COALESCE(NULLIF(v_subject_n, ''), lower(trim(p_subject))), 80),
    p_class_level,
    left(COALESCE(NULLIF(v_topic_n, ''), lower(trim(p_topic))), 400),
    left(COALESCE(NULLIF(v_sub_n, ''), lower(trim(p_subtopic_name))), 400),
    v_level,
    v_reward, v_pct, v_corr, v_tot
  )
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    SELECT rdm INTO v_balance FROM public.profiles WHERE id = v_uid;
    RETURN jsonb_build_object(
      'awarded', false, 'amount', 0, 'balance', COALESCE(v_balance, 0),
      'reason', 'already_claimed_subtopic',
      'score_percent', v_pct, 'correct', v_corr, 'total', v_tot
    );
  END IF;

  v_new_rdm := public.add_rdm(v_uid, v_reward);
  RETURN jsonb_build_object(
    'awarded', true, 'amount', v_reward, 'balance', v_new_rdm, 'reason', NULL,
    'score_percent', v_pct, 'correct', v_corr, 'total', v_tot
  );
END;
$$;

COMMENT ON FUNCTION public.claim_numerals_pack_complete_daily_rdm(
  text, text, integer, text, text, text
) IS 'Numerals overall ≥60% once per subtopic+level. Reads student_bits_attempts first.';
