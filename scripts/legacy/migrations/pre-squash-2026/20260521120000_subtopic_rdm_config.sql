-- Subtopic lesson rewards: rdm_config keys + RPCs read amounts from public.rdm_config (clamped 1-500).

INSERT INTO public.rdm_config (key, value, description) VALUES
  ('subtopic_quiz_advanced_rdm', 15, 'Subtopic · Advanced quiz (3-set, ≥60%) daily RDM'),
  ('subtopic_numerals_pack_rdm', 20, 'Subtopic · Numerals pack complete (≥60%) daily RDM')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description;


CREATE OR REPLACE FUNCTION public.claim_topic_quiz_advanced_daily_rdm(
  p_board text,
  p_subject text,
  p_class_level integer,
  p_topic text,
  p_subtopic_name text
)
RETURNS jsonb
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
  v_s1 int;
  v_s2 int;
  v_s3 int;
  v_store jsonb;
  att1 jsonb;
  att2 jsonb;
  att3 jsonb;
  k1 text;
  k2 text;
  k3 text;
  set_idx int;
  start_i int;
  end_excl int;
  slice_len int;
  att jsonb;
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
  v_award jsonb;
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
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object(
      'awarded', false,
      'amount', 0,
      'balance', NULL,
      'reason', 'not_authenticated'
    );
  END IF;

  IF public.is_gyan_bot_user(v_uid) THEN
    RETURN jsonb_build_object('awarded', false, 'amount', 0, 'balance', NULL, 'reason', 'gyan_bot');
  END IF;

  IF p_class_level IS NULL OR p_class_level NOT IN (11, 12) THEN
    RETURN jsonb_build_object(
      'awarded', false,
      'amount', 0,
      'balance', NULL,
      'reason', 'invalid_class_level'
    );
  END IF;

  IF v_board_n = '' OR v_subject_n = '' OR v_topic_n = '' OR v_sub_n = '' THEN
    RETURN jsonb_build_object(
      'awarded', false,
      'amount', 0,
      'balance', NULL,
      'reason', 'invalid_scope'
    );
  END IF;

  INSERT INTO public.topic_quiz_advanced_rdm_attempts (
    user_id,
    ist_claim_date,
    board,
    subject,
    class_level,
    topic,
    subtopic_name,
    eligible,
    denial_reason,
    rdm_awarded
  )
  VALUES (
    v_uid,
    v_ist,
    left(v_board_n, 80),
    left(v_subject_n, 80),
    p_class_level,
    left(v_topic_n, 400),
    left(v_sub_n, 400),
    false,
    'in_progress',
    0
  )
  RETURNING id INTO v_audit_id;

  v_denial := NULL;

  SELECT sc.bits_questions
  INTO v_bits
  FROM public.subtopic_content sc
  WHERE sc.board = v_board_n
    AND sc.subject = v_subject_n
    AND sc.class_level = p_class_level
    AND sc.topic = v_topic_n
    AND sc.subtopic_name = v_sub_n
    AND sc.level = 'advanced'
  LIMIT 1;

  IF v_bits IS NULL AND (v_topic_legacy <> v_topic_n OR v_sub_legacy <> v_sub_n) THEN
    SELECT sc.bits_questions
    INTO v_bits
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
    IF v_n <= 10 THEN
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
    v_s1 := LEAST(10, v_n);
    v_s2 := LEAST(10, GREATEST(0, v_n - 10));
    v_s3 := GREATEST(0, v_n - 20);

    SELECT p.bits_test_attempts
    INTO v_store
    FROM public.profiles p
    WHERE p.id = v_uid;

    IF v_store IS NULL OR jsonb_typeof(v_store) <> 'object' THEN
      v_denial := 'no_attempts_store';
    END IF;
  END IF;

  IF v_denial IS NULL THEN
    k1 := public._bits_attempt_key(p_board, p_subject, p_class_level, p_topic, p_subtopic_name, 1);
    k2 := public._bits_attempt_key(p_board, p_subject, p_class_level, p_topic, p_subtopic_name, 2);
    k3 := public._bits_attempt_key(p_board, p_subject, p_class_level, p_topic, p_subtopic_name, 3);

    att1 := v_store -> k1;
    att2 := v_store -> k2;
    att3 := v_store -> k3;

    IF v_s1 > 0 AND (att1 IS NULL OR jsonb_typeof(att1) <> 'object') THEN
      v_denial := 'missing_set_1';
    ELSIF v_s2 > 0 AND (att2 IS NULL OR jsonb_typeof(att2) <> 'object') THEN
      v_denial := 'missing_set_2';
    ELSIF v_s3 > 0 AND (att3 IS NULL OR jsonb_typeof(att3) <> 'object') THEN
      v_denial := 'missing_set_3';
    END IF;
  END IF;

  IF v_denial IS NULL THEN
    <<set_loop>>
    FOR set_idx IN 1..3 LOOP
      slice_len := CASE set_idx
        WHEN 1 THEN v_s1
        WHEN 2 THEN v_s2
        ELSE v_s3
      END;
      IF slice_len <= 0 THEN
        CONTINUE;
      END IF;

      start_i := CASE set_idx
        WHEN 1 THEN 0
        WHEN 2 THEN v_s1
        ELSE v_s1 + v_s2
      END;
      end_excl := start_i + slice_len;

      att := CASE set_idx
        WHEN 1 THEN att1
        WHEN 2 THEN att2
        ELSE att3
      END;

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
    v_award := public.award_daily_rdm(v_uid, 'TOPIC_QUIZ_ADVANCED_60', v_quiz_rdm);
    IF COALESCE((v_award ->> 'awarded')::boolean, false) THEN
      v_rdm := COALESCE((v_award ->> 'amount')::int, v_quiz_rdm);
      v_out := v_award || jsonb_build_object('score_percent', v_pct, 'correct', corr, 'total', tot);
    ELSE
      v_denial := COALESCE(v_award ->> 'reason', 'award_failed');
      v_out := jsonb_build_object(
        'awarded', false,
        'amount', 0,
        'balance', v_award -> 'balance',
        'reason', v_denial,
        'claim_date_ist', v_award -> 'claim_date_ist',
        'score_percent', v_pct,
        'correct', corr,
        'total', tot
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

REVOKE ALL ON FUNCTION public.claim_topic_quiz_advanced_daily_rdm(text, text, integer, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_topic_quiz_advanced_daily_rdm(text, text, integer, text, text) TO authenticated;

COMMENT ON FUNCTION public.claim_topic_quiz_advanced_daily_rdm(text, text, integer, text, text) IS
  'Advanced 3-set topic quiz: re-grade from subtopic_content, overall >= 60%, RDM from rdm_config key subtopic_quiz_advanced_rdm (default 15) once per IST day (global).';

-- Numerals pack: RDM amount from rdm_config (subtopic_numerals_pack_rdm, default 20).

CREATE OR REPLACE FUNCTION public.claim_numerals_pack_complete_daily_rdm(
  p_board text,
  p_subject text,
  p_class_level integer,
  p_topic text,
  p_subtopic_name text,
  p_level text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_formulas jsonb;
  v_bits jsonb;
  v_elem jsonb;
  v_bq jsonb;
  v_key text;
  v_sig_expected text;
  v_sig_att text;
  v_i int;
  v_n int;
  v_required int := 0;
  v_att jsonb;
  v_award jsonb;
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
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('awarded', false, 'amount', 0, 'balance', NULL, 'reason', 'unauthenticated');
  END IF;

  IF p_class_level NOT IN (11, 12) OR lower(trim(p_level)) NOT IN ('basics', 'intermediate', 'advanced') THEN
    RETURN jsonb_build_object('awarded', false, 'amount', 0, 'balance', NULL, 'reason', 'invalid_scope');
  END IF;

  SELECT sc.practice_formulas INTO v_formulas
  FROM public.subtopic_content sc
  WHERE lower(trim(sc.board)) = lower(trim(p_board))
    AND lower(trim(sc.subject)) = lower(trim(p_subject))
    AND sc.class_level = p_class_level
    AND lower(trim(sc.topic)) = lower(trim(p_topic))
    AND lower(trim(sc.subtopic_name)) = lower(trim(p_subtopic_name))
    AND lower(trim(sc.level)) = lower(trim(p_level))
  LIMIT 1;

  IF v_formulas IS NULL OR jsonb_typeof(v_formulas) <> 'array' THEN
    RETURN jsonb_build_object('awarded', false, 'amount', 0, 'balance', NULL, 'reason', 'subtopic_not_found');
  END IF;

  v_n := jsonb_array_length(v_formulas);
  IF v_n <= 0 THEN
    RETURN jsonb_build_object('awarded', false, 'amount', 0, 'balance', NULL, 'reason', 'no_formulas');
  END IF;

  SELECT COALESCE(p.bits_test_attempts, '{}'::jsonb) INTO v_bits
  FROM public.profiles p
  WHERE p.id = v_uid;

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
      p_board,
      p_subject,
      p_class_level,
      p_topic,
      p_subtopic_name,
      p_level,
      v_i
    );

    IF NOT (v_bits ? v_key) THEN
      SELECT rdm INTO v_balance FROM public.profiles WHERE id = v_uid;
      RETURN jsonb_build_object(
        'awarded', false,
        'amount', 0,
        'balance', COALESCE(v_balance, 0),
        'reason',
        'incomplete_numerals'
      );
    END IF;

    v_att := v_bits -> v_key;
    IF v_att IS NULL OR jsonb_typeof(v_att) <> 'object' THEN
      SELECT rdm INTO v_balance FROM public.profiles WHERE id = v_uid;
      RETURN jsonb_build_object(
        'awarded', false,
        'amount', 0,
        'balance', COALESCE(v_balance, 0),
        'reason',
        'bad_attempt_blob'
      );
    END IF;

    v_sig_expected := public.bits_signature_v1(v_bq);
    v_sig_att := v_att ->> 'bitsSignature';
    IF v_sig_att IS DISTINCT FROM v_sig_expected THEN
      SELECT rdm INTO v_balance FROM public.profiles WHERE id = v_uid;
      RETURN jsonb_build_object(
        'awarded', false,
        'amount', 0,
        'balance', COALESCE(v_balance, 0),
        'reason',
        'stale_or_mismatch_signature'
      );
    END IF;

    sa := v_att -> 'selectedAnswers';
    IF sa IS NULL OR jsonb_typeof(sa) <> 'object' THEN
      SELECT rdm INTO v_balance FROM public.profiles WHERE id = v_uid;
      RETURN jsonb_build_object(
        'awarded', false,
        'amount', 0,
        'balance', COALESCE(v_balance, 0),
        'reason',
        'missing_selected_answers_formula_' || v_i::text
      );
    END IF;

    FOR qi IN 0..jsonb_array_length(v_bq) - 1 LOOP
      ans_key := qi::text;
      IF NOT (sa ? ans_key) THEN
        SELECT rdm INTO v_balance FROM public.profiles WHERE id = v_uid;
        RETURN jsonb_build_object(
          'awarded', false,
          'amount', 0,
          'balance', COALESCE(v_balance, 0),
          'reason',
          'missing_answer_formula_' || v_i::text || '_q_' || ans_key
        );
      END IF;

      si := (sa ->> ans_key)::int;
      IF si IS NULL OR si < 0 OR si > 3 THEN
        SELECT rdm INTO v_balance FROM public.profiles WHERE id = v_uid;
        RETURN jsonb_build_object(
          'awarded', false,
          'amount', 0,
          'balance', COALESCE(v_balance, 0),
          'reason',
          'invalid_answer_index_formula_' || v_i::text || '_q_' || ans_key
        );
      END IF;

      q := v_bq -> qi;
      IF q IS NULL OR jsonb_typeof(q) <> 'object' THEN
        SELECT rdm INTO v_balance FROM public.profiles WHERE id = v_uid;
        RETURN jsonb_build_object(
          'awarded', false,
          'amount', 0,
          'balance', COALESCE(v_balance, 0),
          'reason',
          'missing_question_formula_' || v_i::text || '_q_' || ans_key
        );
      END IF;

      opts := q -> 'options';
      IF opts IS NULL OR jsonb_typeof(opts) <> 'array' OR si >= jsonb_array_length(opts) THEN
        SELECT rdm INTO v_balance FROM public.profiles WHERE id = v_uid;
        RETURN jsonb_build_object(
          'awarded', false,
          'amount', 0,
          'balance', COALESCE(v_balance, 0),
          'reason',
          'invalid_options_formula_' || v_i::text || '_q_' || ans_key
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
      'awarded', false,
      'amount', 0,
      'balance', COALESCE(v_balance, 0),
      'reason',
      'nothing_graded'
    );
  END IF;

  v_pct := round(100.0 * v_corr::numeric / v_tot::numeric)::int;
  IF v_pct < 60 THEN
    SELECT rdm INTO v_balance FROM public.profiles WHERE id = v_uid;
    RETURN jsonb_build_object(
      'awarded', false,
      'amount', 0,
      'balance', COALESCE(v_balance, 0),
      'reason',
      'below_threshold',
      'score_percent', v_pct,
      'correct', v_corr,
      'total', v_tot
    );
  END IF;

  v_award := public.award_daily_rdm(
    v_uid,
    'NUMERALS_PACK_COMPLETE',
    GREATEST(1, LEAST(500, COALESCE(
      (SELECT value FROM public.rdm_config WHERE key = 'subtopic_numerals_pack_rdm' LIMIT 1), 20)))
  );
  IF COALESCE((v_award ->> 'awarded')::boolean, false) THEN
    RETURN v_award || jsonb_build_object('score_percent', v_pct, 'correct', v_corr, 'total', v_tot);
  END IF;

  RETURN v_award
    || jsonb_build_object(
      'score_percent', v_pct,
      'correct', v_corr,
      'total', v_tot
    );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_numerals_pack_complete_daily_rdm(text, text, integer, text, text, text)
FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_numerals_pack_complete_daily_rdm(text, text, integer, text, text, text)
TO authenticated;

COMMENT ON FUNCTION public.claim_numerals_pack_complete_daily_rdm(text, text, integer, text, text, text) IS
  'All numerals submitted + server-regraded overall ≥60%: RDM from rdm_config key subtopic_numerals_pack_rdm (default 20) once per IST day (NUMERALS_PACK_COMPLETE).';
