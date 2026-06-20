-- +40 RDM when user posts mock results to community (lessons_raw_posts).
-- Server verifies post ownership, source_type mock_test, tag mock_test, and attemptKey.
-- At most one grant per user per attempt_key (finished mock session).

CREATE TABLE IF NOT EXISTS public.mock_community_share_rdm_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.lessons_raw_posts (id) ON DELETE CASCADE,
  attempt_key text NOT NULL,
  rdm_amount integer NOT NULL DEFAULT 40,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mock_comm_share_user_attempt UNIQUE (user_id, attempt_key),
  CONSTRAINT mock_comm_share_user_post UNIQUE (user_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_mock_comm_share_user_created
  ON public.mock_community_share_rdm_claims (user_id, created_at DESC);

COMMENT ON TABLE public.mock_community_share_rdm_claims IS
  '+40 RDM for verified mock_test community post; one row per user per attempt_key.';

ALTER TABLE public.mock_community_share_rdm_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mock_comm_share_select_own" ON public.mock_community_share_rdm_claims;
CREATE POLICY "mock_comm_share_select_own"
  ON public.mock_community_share_rdm_claims FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.claim_mock_community_share_rdm(p_post_id uuid)
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

  IF v_source_type IS DISTINCT FROM 'mock_test' THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'invalid_source');
  END IF;

  IF v_tags IS NULL OR NOT ('mock_test' = ANY (v_tags)) THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'invalid_source');
  END IF;

  v_attempt := trim(both from coalesce(v_payload->>'attemptKey', ''));
  IF length(v_attempt) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'missing_attempt_key');
  END IF;

  PERFORM pg_advisory_xact_lock(904322, hashtext(v_uid::text));

  IF EXISTS (
    SELECT 1 FROM public.mock_community_share_rdm_claims c
    WHERE c.user_id = v_uid AND c.attempt_key = v_attempt
  ) THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'already_claimed_session');
  END IF;

  BEGIN
    INSERT INTO public.mock_community_share_rdm_claims (user_id, post_id, attempt_key, rdm_amount)
    VALUES (v_uid, p_post_id, v_attempt, 40);
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'already_claimed_session');
  END;

  v_new_rdm := public.add_rdm(v_uid, 40);

  RETURN jsonb_build_object(
    'ok', true,
    'rdm_awarded', 40,
    'new_rdm_balance', v_new_rdm,
    'post_id', p_post_id
  );
END;
$$;

COMMENT ON FUNCTION public.claim_mock_community_share_rdm IS
  'Authenticated: verify lessons_raw_posts row is mock_test share, grant +40 RDM once per attempt_key.';

REVOKE ALL ON FUNCTION public.claim_mock_community_share_rdm(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_mock_community_share_rdm(uuid) TO authenticated;
