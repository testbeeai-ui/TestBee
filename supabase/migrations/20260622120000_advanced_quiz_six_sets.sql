-- Advanced topic quiz: 6 sets (5+5+5+5+5+remainder) instead of 3×10+remainder.
CREATE OR REPLACE FUNCTION "public"."claim_topic_quiz_advanced_daily_rdm"(
  "p_board" "text",
  "p_subject" "text",
  "p_class_level" integer,
  "p_topic" "text",
  "p_subtopic_name" "text"
) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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
  v_store jsonb;
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
    SELECT p.bits_test_attempts
    INTO v_store
    FROM public.profiles p
    WHERE p.id = v_uid;

    IF v_store IS NULL OR jsonb_typeof(v_store) <> 'object' THEN
      v_denial := 'no_attempts_store';
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
      att := v_store -> k;
      IF att IS NULL OR jsonb_typeof(att) <> 'object' THEN
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
      att := v_store -> k;

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

COMMENT ON FUNCTION "public"."claim_topic_quiz_advanced_daily_rdm"(
  "p_board" "text",
  "p_subject" "text",
  "p_class_level" integer,
  "p_topic" "text",
  "p_subtopic_name" "text"
) IS 'Advanced 6-set topic quiz (5+5+5+5+5+remainder): re-grade from subtopic_content, overall >= 60%, RDM from rdm_config key subtopic_quiz_advanced_rdm (default 15) once per IST day (global).';
