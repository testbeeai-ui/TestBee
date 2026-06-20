-- Quiz + Numerals community-share RDM rewards (once per set / numeral per subtopic).

INSERT INTO public.rdm_config (key, value, description)
VALUES
  ('quiz_community_share_rdm', 5, 'Lessons · Quiz result share bonus RDM (once per set per subtopic)'),
  ('numerals_community_share_rdm', 5, 'Lessons · Numerals result share bonus RDM (once per numeral per subtopic)')
ON CONFLICT (key) DO UPDATE
SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = now();

CREATE TABLE IF NOT EXISTS public.quiz_community_share_rdm_claims (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  topic_ref text NOT NULL,
  subtopic_ref text NOT NULL,
  quiz_set integer NOT NULL CHECK (quiz_set >= 1),
  post_id uuid NOT NULL REFERENCES public.lessons_raw_posts(id) ON DELETE CASCADE,
  rdm_amount integer NOT NULL CHECK (rdm_amount > 0),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quiz_community_share_rdm_claims_pkey PRIMARY KEY (user_id, topic_ref, subtopic_ref, quiz_set)
);

CREATE INDEX IF NOT EXISTS quiz_community_share_rdm_claims_user_claimed_idx
  ON public.quiz_community_share_rdm_claims (user_id, claimed_at DESC);

ALTER TABLE public.quiz_community_share_rdm_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quiz_community_share_rdm_claims_select_own" ON public.quiz_community_share_rdm_claims;
CREATE POLICY "quiz_community_share_rdm_claims_select_own"
ON public.quiz_community_share_rdm_claims
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.numerals_community_share_rdm_claims (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  topic_ref text NOT NULL,
  subtopic_ref text NOT NULL,
  formula_index integer NOT NULL CHECK (formula_index >= 0),
  post_id uuid NOT NULL REFERENCES public.lessons_raw_posts(id) ON DELETE CASCADE,
  rdm_amount integer NOT NULL CHECK (rdm_amount > 0),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT numerals_community_share_rdm_claims_pkey PRIMARY KEY (user_id, topic_ref, subtopic_ref, formula_index)
);

CREATE INDEX IF NOT EXISTS numerals_community_share_rdm_claims_user_claimed_idx
  ON public.numerals_community_share_rdm_claims (user_id, claimed_at DESC);

ALTER TABLE public.numerals_community_share_rdm_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "numerals_community_share_rdm_claims_select_own" ON public.numerals_community_share_rdm_claims;
CREATE POLICY "numerals_community_share_rdm_claims_select_own"
ON public.numerals_community_share_rdm_claims
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.claim_quiz_community_share_rdm(p_post_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_post_user_id uuid;
  v_kind text;
  v_source_type text;
  v_payload jsonb;
  v_topic_ref text;
  v_subtopic_ref text;
  v_quiz_set integer;
  v_reward_rdm integer;
  v_new_rdm integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'unauthenticated');
  END IF;

  BEGIN
    SELECT
      lp.user_id,
      lp.kind,
      lp.source_type,
      lp.source_payload,
      trim(both from coalesce(lp.topic_ref, '')),
      trim(both from coalesce(lp.subtopic_ref, ''))
    INTO STRICT
      v_post_user_id,
      v_kind,
      v_source_type,
      v_payload,
      v_topic_ref,
      v_subtopic_ref
    FROM public.lessons_raw_posts lp
    WHERE lp.id = p_post_id;
  EXCEPTION WHEN NO_DATA_FOUND THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'post_not_found');
  END;

  IF v_post_user_id IS DISTINCT FROM v_uid THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'wrong_owner');
  END IF;

  IF v_kind IS DISTINCT FROM 'post' OR v_source_type IS DISTINCT FROM 'quiz_post' THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'invalid_source');
  END IF;

  IF length(v_topic_ref) = 0 OR length(v_subtopic_ref) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'missing_scope');
  END IF;

  v_quiz_set := NULLIF(trim(both from coalesce(v_payload->>'quizSetNumber', '')), '')::integer;
  IF v_quiz_set IS NULL OR v_quiz_set < 1 THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'missing_quiz_set');
  END IF;

  PERFORM pg_advisory_xact_lock(914021, hashtext(v_uid::text));

  IF EXISTS (
    SELECT 1
    FROM public.quiz_community_share_rdm_claims c
    WHERE c.user_id = v_uid
      AND c.topic_ref = v_topic_ref
      AND c.subtopic_ref = v_subtopic_ref
      AND c.quiz_set = v_quiz_set
  ) THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'already_claimed_set');
  END IF;

  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'quiz_community_share_rdm'), 5)
  INTO v_reward_rdm;
  v_reward_rdm := GREATEST(1, v_reward_rdm);

  BEGIN
    INSERT INTO public.quiz_community_share_rdm_claims (
      user_id, topic_ref, subtopic_ref, quiz_set, post_id, rdm_amount
    )
    VALUES (
      v_uid, v_topic_ref, v_subtopic_ref, v_quiz_set, p_post_id, v_reward_rdm
    );
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'already_claimed_set');
  END;

  v_new_rdm := public.add_rdm(v_uid, v_reward_rdm);

  RETURN jsonb_build_object(
    'ok', true,
    'rdm_awarded', v_reward_rdm,
    'new_rdm_balance', v_new_rdm,
    'quiz_set', v_quiz_set
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_quiz_community_share_rdm(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_quiz_community_share_rdm(uuid) TO authenticated;

COMMENT ON FUNCTION public.claim_quiz_community_share_rdm IS
  'Authenticated: grants quiz post share bonus once per (topic_ref, subtopic_ref, quiz_set) per user.';

CREATE OR REPLACE FUNCTION public.claim_numerals_community_share_rdm(p_post_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_post_user_id uuid;
  v_kind text;
  v_source_type text;
  v_payload jsonb;
  v_topic_ref text;
  v_subtopic_ref text;
  v_formula_index integer;
  v_reward_rdm integer;
  v_new_rdm integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'unauthenticated');
  END IF;

  BEGIN
    SELECT
      lp.user_id,
      lp.kind,
      lp.source_type,
      lp.source_payload,
      trim(both from coalesce(lp.topic_ref, '')),
      trim(both from coalesce(lp.subtopic_ref, ''))
    INTO STRICT
      v_post_user_id,
      v_kind,
      v_source_type,
      v_payload,
      v_topic_ref,
      v_subtopic_ref
    FROM public.lessons_raw_posts lp
    WHERE lp.id = p_post_id;
  EXCEPTION WHEN NO_DATA_FOUND THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'post_not_found');
  END;

  IF v_post_user_id IS DISTINCT FROM v_uid THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'wrong_owner');
  END IF;

  IF v_kind IS DISTINCT FROM 'post' OR v_source_type IS DISTINCT FROM 'numerals_post' THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'invalid_source');
  END IF;

  IF length(v_topic_ref) = 0 OR length(v_subtopic_ref) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'missing_scope');
  END IF;

  v_formula_index := NULLIF(trim(both from coalesce(v_payload->>'formulaIndex', '')), '')::integer;
  IF v_formula_index IS NULL OR v_formula_index < 0 THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'missing_formula_index');
  END IF;

  PERFORM pg_advisory_xact_lock(914022, hashtext(v_uid::text));

  IF EXISTS (
    SELECT 1
    FROM public.numerals_community_share_rdm_claims c
    WHERE c.user_id = v_uid
      AND c.topic_ref = v_topic_ref
      AND c.subtopic_ref = v_subtopic_ref
      AND c.formula_index = v_formula_index
  ) THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'already_claimed_numeral');
  END IF;

  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'numerals_community_share_rdm'), 5)
  INTO v_reward_rdm;
  v_reward_rdm := GREATEST(1, v_reward_rdm);

  BEGIN
    INSERT INTO public.numerals_community_share_rdm_claims (
      user_id, topic_ref, subtopic_ref, formula_index, post_id, rdm_amount
    )
    VALUES (
      v_uid, v_topic_ref, v_subtopic_ref, v_formula_index, p_post_id, v_reward_rdm
    );
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'already_claimed_numeral');
  END;

  v_new_rdm := public.add_rdm(v_uid, v_reward_rdm);

  RETURN jsonb_build_object(
    'ok', true,
    'rdm_awarded', v_reward_rdm,
    'new_rdm_balance', v_new_rdm,
    'formula_index', v_formula_index
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_numerals_community_share_rdm(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_numerals_community_share_rdm(uuid) TO authenticated;

COMMENT ON FUNCTION public.claim_numerals_community_share_rdm IS
  'Authenticated: grants numerals post share bonus once per (topic_ref, subtopic_ref, formula_index) per user.';
