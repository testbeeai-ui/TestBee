-- Numerals pack daily RDM: require ≥60% overall (pooled across all practice formulas with questions),
-- server-regraded from practice_formulas.bitsQuestions (do not trust client correctCount).

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

  v_award := public.award_daily_rdm(v_uid, 'NUMERALS_PACK_COMPLETE', 15);
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

COMMENT ON FUNCTION public.claim_numerals_pack_complete_daily_rdm(text, text, integer, text, text, text) IS
  'All numerals submitted + server-regraded overall ≥60%: +15 RDM once per IST day (NUMERALS_PACK_COMPLETE).';
