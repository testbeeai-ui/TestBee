-- Advanced topic quiz: +15 RDM when all non-empty sets are submitted with overall >= 60% (IST),
-- server-recomputed from subtopic_content.bits_questions. At most one claim per user per IST day
-- across all subtopics (daily_reward_claims action TOPIC_QUIZ_ADVANCED_60).

-- ─── daily_reward_claims: new action type ───────────────────────────────────
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
      'TOPIC_QUIZ_ADVANCED_60'
    )
  );

-- ─── award_daily_rdm: allow new action ─────────────────────────────────────
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
    'TOPIC_QUIZ_ADVANCED_60'
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
  'IST-day-first RDM; includes INSTACUE_CREATE and TOPIC_QUIZ_ADVANCED_60.';

-- ─── bits_signature_v1: must match lib/bitsSignature.ts (getBitsSignature) ─
CREATE OR REPLACE FUNCTION public._js_int32_wrap(x bigint)
RETURNS bigint
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT (
    CASE
      WHEN ((x % 4294967296) + 4294967296) % 4294967296 >= 2147483648
      THEN ((x % 4294967296) + 4294967296) % 4294967296 - 4294967296
      ELSE ((x % 4294967296) + 4294967296) % 4294967296
    END
  )::bigint;
$$;

CREATE OR REPLACE FUNCTION public.bits_signature_v1(bits_questions jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  n int;
  i int;
  oi int;
  elem jsonb;
  opts jsonb;
  q text;
  ca text;
  opt_join text;
  raw text := '';
  j int;
  h bigint := 0;
  cp int;
  v_len int;
  ch text;
BEGIN
  IF bits_questions IS NULL OR jsonb_typeof(bits_questions) <> 'array' THEN
    RETURN NULL;
  END IF;
  n := jsonb_array_length(bits_questions);
  IF n < 1 THEN
    RETURN NULL;
  END IF;

  FOR i IN 0..n - 1 LOOP
    elem := bits_questions -> i;
    IF elem IS NULL OR jsonb_typeof(elem) <> 'object' THEN
      CONTINUE;
    END IF;
    q := COALESCE(elem ->> 'question', '');
    ca := COALESCE(elem ->> 'correctAnswer', '');
    opts := elem -> 'options';
    opt_join := '';
    IF opts IS NOT NULL AND jsonb_typeof(opts) = 'array' THEN
      FOR oi IN 0..jsonb_array_length(opts) - 1 LOOP
        IF oi > 0 THEN
          opt_join := opt_join || '||';
        END IF;
        opt_join := opt_join || COALESCE(opts ->> oi, '');
      END LOOP;
    END IF;
    IF raw <> '' THEN
      raw := raw || '###';
    END IF;
    raw := raw || (i + 1)::text || '|' || q || '|' || ca || '|' || opt_join;
  END LOOP;

  v_len := char_length(raw);
  FOR j IN 1..v_len LOOP
    ch := substr(raw, j, 1);
    cp := ascii(ch);
    h := public._js_int32_wrap(h * 31 + cp::bigint);
  END LOOP;

  -- bigint abs avoids int overflow at -2^31 (JS Math.abs matches bigint text here).
  RETURN 'v1-' || n::text || '-' || abs(h::bigint)::text;
END;
$$;

REVOKE ALL ON FUNCTION public.bits_signature_v1(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bits_signature_v1(jsonb) TO authenticated;

COMMENT ON FUNCTION public.bits_signature_v1(jsonb) IS
  'Stable fingerprint for bits_questions JSON; must match lib/bitsSignature.ts getBitsSignature.';

-- ─── Audit log ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.topic_quiz_advanced_rdm_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  ist_claim_date date NOT NULL,
  board text,
  subject text,
  class_level integer,
  topic text,
  subtopic_name text,
  eligible boolean NOT NULL DEFAULT false,
  score_percent integer,
  correct_count integer,
  total_questions integer,
  denial_reason text,
  rdm_awarded integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_topic_quiz_adv_rdm_attempts_user_created
  ON public.topic_quiz_advanced_rdm_attempts (user_id, created_at DESC);

COMMENT ON TABLE public.topic_quiz_advanced_rdm_attempts IS
  'Audit log for claim_topic_quiz_advanced_daily_rdm (success + denials).';

ALTER TABLE public.topic_quiz_advanced_rdm_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "topic_quiz_adv_rdm_attempts_select_own" ON public.topic_quiz_advanced_rdm_attempts;
CREATE POLICY "topic_quiz_adv_rdm_attempts_select_own"
  ON public.topic_quiz_advanced_rdm_attempts FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- ─── Normalize helpers (align with bits-attempts + subtopic-content routes) ─
CREATE OR REPLACE FUNCTION public._norm_content_key(t text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT
    left(
      btrim(regexp_replace(regexp_replace(coalesce(t, ''), '[\x00-\x1F\x7F]', ' ', 'g'), '\s+', ' ', 'g')),
      600
    );
$$;

CREATE OR REPLACE FUNCTION public._norm_subject_key(t text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT lower(public._norm_content_key(t));
$$;

CREATE OR REPLACE FUNCTION public._norm_attempt_key_part(t text, max_len int)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT lower(
    left(
      btrim(regexp_replace(regexp_replace(coalesce(t, ''), '[\x00-\x1F\x7F]', ' ', 'g'), '\s+', ' ', 'g')),
      greatest(1, least(max_len, 600))
    )
  );
$$;

CREATE OR REPLACE FUNCTION public._legacy_sanitize_lookup(t text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT
    btrim(
      regexp_replace(
        regexp_replace(coalesce(t, ''), '[<>\x00-\x1F\x7F]', ' ', 'g'),
        '\s+',
        ' ',
        'g'
      )
    );
$$;

CREATE OR REPLACE FUNCTION public._bits_attempt_key(
  p_board text,
  p_subject text,
  p_class_level int,
  p_topic text,
  p_subtopic text,
  p_set int
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT
    public._norm_attempt_key_part(p_board, 40)
    || '||'
    || public._norm_attempt_key_part(p_subject, 80)
    || '||'
    || p_class_level::text
    || '||'
    || public._norm_attempt_key_part(p_topic, 300)
    || '||'
    || public._norm_attempt_key_part(p_subtopic, 300)
    || '||'
    || public._norm_attempt_key_part('advanced', 30)
    || '||set:'
    || p_set::text;
$$;

-- ─── Main claim RPC ─────────────────────────────────────────────────────────
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
    v_award := public.award_daily_rdm(v_uid, 'TOPIC_QUIZ_ADVANCED_60', 15);
    IF COALESCE((v_award ->> 'awarded')::boolean, false) THEN
      v_rdm := COALESCE((v_award ->> 'amount')::int, 15);
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
  'Advanced 3-set topic quiz: re-grade from subtopic_content, overall >= 60%, +15 RDM once per IST day (global).';
