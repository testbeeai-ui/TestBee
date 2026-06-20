-- Numerals: when every practice formula slot with questions is submitted for a subtopic level,
-- +15 RDM at most once per IST day per user (action NUMERALS_PACK_COMPLETE — global for the day).

ALTER TABLE public.daily_reward_claims DROP CONSTRAINT IF EXISTS daily_reward_claims_action_type_check;
ALTER TABLE public.daily_reward_claims
  ADD CONSTRAINT daily_reward_claims_action_type_check
  CHECK (
    action_type IN (
      'ASK',
      'COMMENT',
      'UPVOTE',
      'SAVE',
      'INSTACUE_CREATE',
      'TOPIC_QUIZ_ADVANCED_60',
      'NUMERALS_PACK_COMPLETE'
    )
  );

CREATE OR REPLACE FUNCTION public.award_daily_rdm(
  p_user_id uuid,
  p_action_type text,
  p_points integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ist_date date;
  v_claim_id uuid;
  v_new_balance integer;
  v_balance integer;
BEGIN
  IF p_user_id IS NULL OR p_points IS NULL OR p_points <= 0 THEN
    RETURN jsonb_build_object('awarded', false, 'amount', 0, 'balance', NULL, 'reason', 'invalid_params');
  END IF;
  IF p_action_type NOT IN (
    'ASK',
    'COMMENT',
    'UPVOTE',
    'SAVE',
    'INSTACUE_CREATE',
    'TOPIC_QUIZ_ADVANCED_60',
    'NUMERALS_PACK_COMPLETE'
  ) THEN
    RETURN jsonb_build_object('awarded', false, 'amount', 0, 'balance', NULL, 'reason', 'invalid_action');
  END IF;
  IF public.is_gyan_bot_user(p_user_id) THEN
    SELECT rdm INTO v_balance FROM public.profiles WHERE id = p_user_id;
    RETURN jsonb_build_object(
      'awarded', false,
      'amount', 0,
      'balance', COALESCE(v_balance, 0),
      'reason', 'gyan_bot'
    );
  END IF;

  v_ist_date := ((now() AT TIME ZONE 'Asia/Kolkata'))::date;

  INSERT INTO public.daily_reward_claims (user_id, action_type, claim_date_ist, points_awarded)
  VALUES (p_user_id, p_action_type, v_ist_date, p_points)
  ON CONFLICT (user_id, action_type, claim_date_ist) DO NOTHING
  RETURNING id INTO v_claim_id;

  IF v_claim_id IS NOT NULL THEN
    v_new_balance := public.add_rdm(p_user_id, p_points);
    RETURN jsonb_build_object(
      'awarded', true,
      'amount', p_points,
      'balance', v_new_balance,
      'claim_date_ist', v_ist_date
    );
  END IF;

  SELECT rdm INTO v_balance FROM public.profiles WHERE id = p_user_id;
  RETURN jsonb_build_object(
    'awarded', false,
    'amount', 0,
    'balance', COALESCE(v_balance, 0),
    'claim_date_ist', v_ist_date,
    'reason', 'already_claimed_today'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.award_daily_rdm(uuid, text, integer) FROM PUBLIC;

COMMENT ON FUNCTION public.award_daily_rdm(uuid, text, integer) IS
  'IST-day-first RDM; includes NUMERALS_PACK_COMPLETE (+15 when all numerals submitted).';

-- Key parts aligned with app/api/user/bits-attempts/route.ts (sanitize + normalizeKeyPart).
CREATE OR REPLACE FUNCTION public._bits_sanitize_key_part(p text, maxlen integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT LEFT(
    LOWER(
      trim(
        both ' '
        FROM regexp_replace(
          regexp_replace(coalesce(p, ''), '[[:cntrl:]]', ' ', 'g'),
          '[[:space:]]+',
          ' ',
          'g'
        )
      )
    ),
    maxlen
  );
$$;

CREATE OR REPLACE FUNCTION public._formula_practice_attempt_key(
  p_board text,
  p_subject text,
  p_class_level integer,
  p_topic text,
  p_subtopic_name text,
  p_level text,
  p_formula_idx integer
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT public._bits_sanitize_key_part(p_board, 40)
    || '||'
    || public._bits_sanitize_key_part(p_subject, 80)
    || '||'
    || p_class_level::text
    || '||'
    || public._bits_sanitize_key_part(p_topic, 300)
    || '||'
    || public._bits_sanitize_key_part(p_subtopic_name, 300)
    || '||'
    || public._bits_sanitize_key_part(p_level, 30)
    || '||fp:'
    || p_formula_idx::text;
$$;

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
  END LOOP;

  IF v_required <= 0 THEN
    RETURN jsonb_build_object('awarded', false, 'amount', 0, 'balance', NULL, 'reason', 'no_numerals_required');
  END IF;

  v_award := public.award_daily_rdm(v_uid, 'NUMERALS_PACK_COMPLETE', 15);
  RETURN v_award;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_numerals_pack_complete_daily_rdm(text, text, integer, text, text, text)
FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_numerals_pack_complete_daily_rdm(text, text, integer, text, text, text)
TO authenticated;

COMMENT ON FUNCTION public.claim_numerals_pack_complete_daily_rdm IS
  'All numerals submitted for subtopic level: +15 RDM once per IST day (NUMERALS_PACK_COMPLETE).';
