-- CBSE chapter MCQ RDM (separate from mock_test): win if accuracy >= min %, plus community share.

INSERT INTO public.rdm_config (key, value, description)
VALUES
  (
    'cbse_mcq_community_share_rdm',
    10,
    'CBSE MCQ''s · Community share verified post bonus RDM (once per chapter quiz attempt)'
  ),
  (
    'cbse_mcq_min_accuracy_pct',
    60,
    'CBSE MCQ''s · Minimum accuracy % to win RDM (correct ÷ total × 100, must meet or exceed)'
  ),
  ('cbse_mcq_win_rdm', 5, 'CBSE MCQ''s · Win RDM when accuracy meets minimum % (once per chapter quiz attempt)')
ON CONFLICT (key) DO UPDATE
SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = now();

CREATE TABLE IF NOT EXISTS public.cbse_mcq_community_share_rdm_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.lessons_raw_posts (id) ON DELETE CASCADE,
  attempt_key text NOT NULL,
  rdm_amount integer NOT NULL CHECK (rdm_amount > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, attempt_key)
);

CREATE INDEX IF NOT EXISTS idx_cbse_mcq_comm_share_user_created
  ON public.cbse_mcq_community_share_rdm_claims (user_id, created_at DESC);

COMMENT ON TABLE public.cbse_mcq_community_share_rdm_claims IS
  'One CBSE chapter MCQ community-share RDM grant per user per attempt_key.';

ALTER TABLE public.cbse_mcq_community_share_rdm_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cbse_mcq_comm_share_select_own" ON public.cbse_mcq_community_share_rdm_claims;
CREATE POLICY "cbse_mcq_comm_share_select_own"
  ON public.cbse_mcq_community_share_rdm_claims FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.cbse_mcq_score_bonus_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  paper_id uuid NOT NULL REFERENCES public.mock_papers (id) ON DELETE CASCADE,
  attempt_key text NOT NULL,
  correct_count integer NOT NULL CHECK (correct_count >= 0),
  total_questions integer NOT NULL CHECK (total_questions > 0),
  accuracy_pct integer NOT NULL CHECK (accuracy_pct >= 0 AND accuracy_pct <= 100),
  eligible boolean NOT NULL DEFAULT false,
  rdm_amount integer NOT NULL CHECK (rdm_amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, attempt_key)
);

CREATE INDEX IF NOT EXISTS idx_cbse_mcq_score_bonus_user_created
  ON public.cbse_mcq_score_bonus_claims (user_id, created_at DESC);

COMMENT ON TABLE public.cbse_mcq_score_bonus_claims IS
  'CBSE chapter MCQ win RDM (accuracy >= rdm_config.cbse_mcq_min_accuracy_pct); once per attempt_key.';

ALTER TABLE public.cbse_mcq_score_bonus_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cbse_mcq_score_bonus_select_own" ON public.cbse_mcq_score_bonus_claims;
CREATE POLICY "cbse_mcq_score_bonus_select_own"
  ON public.cbse_mcq_score_bonus_claims FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.claim_cbse_mcq_chapter_score_rdm(
  p_paper_id uuid,
  p_correct integer,
  p_total integer,
  p_attempt_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_attempt text;
  v_paper_ok boolean;
  v_pct integer;
  v_min_pct integer;
  v_win_rdm integer;
  v_eligible boolean;
  v_new_rdm integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'unauthenticated');
  END IF;

  v_attempt := trim(both from coalesce(p_attempt_key, ''));
  IF length(v_attempt) < 3 THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'missing_attempt_key');
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.mock_papers mp
    WHERE mp.id = p_paper_id
      AND mp.published = true
      AND mp.paper_type = 'chapter'
  )
  INTO v_paper_ok;

  IF NOT v_paper_ok THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'paper_not_found');
  END IF;

  IF p_total IS NULL OR p_total <= 0 OR p_correct IS NULL OR p_correct < 0 OR p_correct > p_total THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'invalid_score');
  END IF;

  v_pct := ROUND(100.0 * p_correct::numeric / p_total::numeric)::integer;

  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'cbse_mcq_min_accuracy_pct'), 60)
  INTO v_min_pct;
  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'cbse_mcq_win_rdm'), 5)
  INTO v_win_rdm;

  v_min_pct := GREATEST(0, LEAST(100, v_min_pct));
  v_win_rdm := GREATEST(0, v_win_rdm);
  v_eligible := v_pct >= v_min_pct AND v_win_rdm > 0;

  PERFORM pg_advisory_xact_lock(904323, hashtext(v_uid::text));

  IF EXISTS (
    SELECT 1 FROM public.cbse_mcq_score_bonus_claims c
    WHERE c.user_id = v_uid AND c.attempt_key = v_attempt
  ) THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'already_claimed_session');
  END IF;

  IF NOT v_eligible THEN
    INSERT INTO public.cbse_mcq_score_bonus_claims (
      user_id, paper_id, attempt_key, correct_count, total_questions,
      accuracy_pct, eligible, rdm_amount
    ) VALUES (
      v_uid, p_paper_id, v_attempt, p_correct, p_total, v_pct, false, 0
    );
    RETURN jsonb_build_object(
      'ok', false,
      'denial_reason', 'below_minimum',
      'accuracy_pct', v_pct,
      'min_accuracy_pct', v_min_pct,
      'rdm_amount', 0
    );
  END IF;

  BEGIN
    INSERT INTO public.cbse_mcq_score_bonus_claims (
      user_id, paper_id, attempt_key, correct_count, total_questions,
      accuracy_pct, eligible, rdm_amount
    ) VALUES (
      v_uid, p_paper_id, v_attempt, p_correct, p_total, v_pct, true, v_win_rdm
    );
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'already_claimed_session');
  END;

  v_new_rdm := public.add_rdm(v_uid, v_win_rdm);

  RETURN jsonb_build_object(
    'ok', true,
    'rdm_awarded', v_win_rdm,
    'new_rdm_balance', v_new_rdm,
    'accuracy_pct', v_pct,
    'min_accuracy_pct', v_min_pct,
    'eligible', true
  );
END;
$$;

COMMENT ON FUNCTION public.claim_cbse_mcq_chapter_score_rdm IS
  'Authenticated: chapter quiz win RDM when accuracy >= cbse_mcq_min_accuracy_pct; once per attempt_key.';

REVOKE ALL ON FUNCTION public.claim_cbse_mcq_chapter_score_rdm(uuid, integer, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_cbse_mcq_chapter_score_rdm(uuid, integer, integer, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_cbse_mcq_community_share_rdm(p_post_id uuid)
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
  v_tags text[];
  v_attempt text;
  v_new_rdm integer;
  v_reward_rdm integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'unauthenticated');
  END IF;

  BEGIN
    SELECT lp.user_id, lp.kind, lp.source_type, lp.source_payload, lp.tags
    INTO STRICT v_post_user_id, v_kind, v_source_type, v_payload, v_tags
    FROM public.lessons_raw_posts lp
    WHERE lp.id = p_post_id;
  EXCEPTION WHEN NO_DATA_FOUND THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'post_not_found');
  END;

  IF v_post_user_id IS DISTINCT FROM v_uid THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'wrong_owner');
  END IF;

  IF v_kind IS DISTINCT FROM 'post' THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'invalid_source');
  END IF;

  IF v_source_type IS DISTINCT FROM 'cbse_mcq_chapter'
    OR v_tags IS NULL
    OR NOT ('cbse_mcq_chapter' = ANY (v_tags)) THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'invalid_source');
  END IF;

  v_attempt := trim(both from coalesce(v_payload->>'attemptKey', ''));
  IF length(v_attempt) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'missing_attempt_key');
  END IF;

  PERFORM pg_advisory_xact_lock(904324, hashtext(v_uid::text));

  IF EXISTS (
    SELECT 1 FROM public.cbse_mcq_community_share_rdm_claims c
    WHERE c.user_id = v_uid AND c.attempt_key = v_attempt
  ) THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'already_claimed_session');
  END IF;

  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'cbse_mcq_community_share_rdm'), 10)
  INTO v_reward_rdm;
  v_reward_rdm := GREATEST(1, v_reward_rdm);

  BEGIN
    INSERT INTO public.cbse_mcq_community_share_rdm_claims (user_id, post_id, attempt_key, rdm_amount)
    VALUES (v_uid, p_post_id, v_attempt, v_reward_rdm);
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'already_claimed_session');
  END;

  v_new_rdm := public.add_rdm(v_uid, v_reward_rdm);

  RETURN jsonb_build_object(
    'ok', true,
    'rdm_awarded', v_reward_rdm,
    'new_rdm_balance', v_new_rdm,
    'post_id', p_post_id
  );
END;
$$;

COMMENT ON FUNCTION public.claim_cbse_mcq_community_share_rdm IS
  'Authenticated: verify lessons_raw_posts is cbse_mcq_chapter share; grant rdm_config.cbse_mcq_community_share_rdm once per attempt_key.';

REVOKE ALL ON FUNCTION public.claim_cbse_mcq_community_share_rdm(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_cbse_mcq_community_share_rdm(uuid) TO authenticated;
