-- Multi-buddy support (up to 5 active) + per-user privacy settings for Learning Buddy Advanced.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS buddy_privacy_settings jsonb NOT NULL DEFAULT '{
    "share_streak": true,
    "share_rdm": true,
    "share_mocks": true,
    "share_gyan": true,
    "share_subtopics": true,
    "share_instacue": false,
    "share_classes": false,
    "share_play": true,
    "share_community": true,
    "share_edufund": true
  }'::jsonb;

COMMENT ON COLUMN public.profiles.buddy_privacy_settings IS
  'What this user shares with study buddies (Learning Buddy Advanced).';

DROP INDEX IF EXISTS public.study_buddies_one_active_per_user;

-- ---------- accept_buddy_invite (multi-buddy, max 5) ----------
CREATE OR REPLACE FUNCTION public.accept_buddy_invite(p_token text, p_acceptor_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite RECORD;
  v_acceptor_onboarded boolean;
  v_pair_id uuid;
  v_referral_credited boolean := false;
  v_already_paired boolean := false;
  v_acceptor_buddy_count int;
  v_inviter_buddy_count int;
  v_max_buddies int := 5;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) < 8 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;

  SELECT id, inviter_user_id, status, expires_at, accepted_by_user_id
    INTO v_invite
  FROM public.buddy_invites
  WHERE token = p_token
  LIMIT 1;

  IF v_invite.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_invite.status = 'accepted' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_accepted');
  END IF;

  IF v_invite.status = 'revoked' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'revoked');
  END IF;

  IF v_invite.expires_at <= now() THEN
    UPDATE public.buddy_invites SET status = 'expired' WHERE id = v_invite.id;
    RETURN jsonb_build_object('ok', false, 'error', 'expired');
  END IF;

  IF v_invite.inviter_user_id = p_acceptor_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'self_invite');
  END IF;

  SELECT onboarding_complete INTO v_acceptor_onboarded
  FROM public.profiles WHERE id = p_acceptor_id;
  IF v_acceptor_onboarded IS DISTINCT FROM true THEN
    RETURN jsonb_build_object('ok', false, 'error', 'onboarding_incomplete');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.study_buddies
    WHERE status = 'active'
      AND user_id = p_acceptor_id
      AND buddy_user_id = v_invite.inviter_user_id
  ) THEN
    v_already_paired := true;
  END IF;

  IF NOT v_already_paired THEN
    SELECT count(*)::int INTO v_acceptor_buddy_count
    FROM public.study_buddies
    WHERE user_id = p_acceptor_id AND status = 'active';

    SELECT count(*)::int INTO v_inviter_buddy_count
    FROM public.study_buddies
    WHERE user_id = v_invite.inviter_user_id AND status = 'active';

    IF v_acceptor_buddy_count >= v_max_buddies THEN
      RETURN jsonb_build_object('ok', false, 'error', 'acceptor_buddy_limit');
    END IF;

    IF v_inviter_buddy_count >= v_max_buddies THEN
      RETURN jsonb_build_object('ok', false, 'error', 'inviter_buddy_limit');
    END IF;

    INSERT INTO public.study_buddies (user_id, buddy_user_id, status)
    VALUES (p_acceptor_id, v_invite.inviter_user_id, 'active')
    ON CONFLICT (user_id, buddy_user_id) DO UPDATE SET status = 'active', ended_at = NULL
    RETURNING id INTO v_pair_id;

    INSERT INTO public.study_buddies (user_id, buddy_user_id, status)
    VALUES (v_invite.inviter_user_id, p_acceptor_id, 'active')
    ON CONFLICT (user_id, buddy_user_id) DO UPDATE SET status = 'active', ended_at = NULL;
  END IF;

  UPDATE public.buddy_invites
     SET status = 'accepted',
         accepted_by_user_id = p_acceptor_id,
         accepted_at = now()
   WHERE id = v_invite.id AND status = 'pending';

  IF NOT EXISTS (SELECT 1 FROM public.referral_attributions WHERE referee_user_id = p_acceptor_id) THEN
    BEGIN
      PERFORM public.claim_referral_attribution(
        upper(substr(replace(v_invite.inviter_user_id::text, '-', ''), 1, 7)),
        p_acceptor_id
      );
      v_referral_credited := true;
    EXCEPTION WHEN OTHERS THEN
      v_referral_credited := false;
    END;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'pairId', v_pair_id,
    'alreadyPaired', v_already_paired,
    'referralCredited', v_referral_credited
  );
END;
$$;

-- ---------- end_buddy_pair (optional specific buddy) ----------
CREATE OR REPLACE FUNCTION public.end_buddy_pair(p_user_id uuid, p_buddy_user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_buddy uuid;
BEGIN
  IF p_buddy_user_id IS NOT NULL THEN
    v_buddy := p_buddy_user_id;
  ELSE
    SELECT buddy_user_id INTO v_buddy
    FROM public.study_buddies
    WHERE user_id = p_user_id AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  IF v_buddy IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_active_buddy');
  END IF;

  UPDATE public.study_buddies
     SET status = 'ended', ended_at = now()
   WHERE status = 'active'
     AND ((user_id = p_user_id AND buddy_user_id = v_buddy)
       OR (user_id = v_buddy AND buddy_user_id = p_user_id));

  RETURN jsonb_build_object('ok', true, 'buddyUserId', v_buddy);
END;
$$;

COMMENT ON FUNCTION public.end_buddy_pair(uuid, uuid) IS
  'Ends one active buddy pair. Pass p_buddy_user_id to end a specific buddy; omit to end most recent.';
