-- Mock test community-share RDM: make reward configurable via rdm_config.

INSERT INTO public.rdm_config (key, value, description)
VALUES
  ('mock_community_share_rdm', 40, 'Mock test · Community share verified post bonus RDM')
ON CONFLICT (key) DO UPDATE
SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = now();

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

  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'mock_community_share_rdm'), 40)
  INTO v_reward_rdm;
  v_reward_rdm := GREATEST(1, v_reward_rdm);

  BEGIN
    INSERT INTO public.mock_community_share_rdm_claims (user_id, post_id, attempt_key, rdm_amount)
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

COMMENT ON FUNCTION public.claim_mock_community_share_rdm IS
  'Authenticated: verify lessons_raw_posts row is mock_test share, grant RDM from rdm_config.mock_community_share_rdm once per attempt_key.';
