-- Serialize buddy accepts per user so concurrent invite accepts cannot exceed plan caps.

CREATE OR REPLACE FUNCTION public.accept_buddy_invite(
  p_token text,
  p_acceptor_id uuid,
  p_acceptor_max int DEFAULT 5,
  p_inviter_max int DEFAULT 5
)
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
  v_acceptor_max int;
  v_inviter_max int;
  v_lock_a text;
  v_lock_b text;
BEGIN
  v_acceptor_max := GREATEST(0, COALESCE(p_acceptor_max, 5));
  v_inviter_max := GREATEST(0, COALESCE(p_inviter_max, 5));

  IF p_token IS NULL OR length(trim(p_token)) < 8 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;

  SELECT id, inviter_user_id, status, expires_at, accepted_by_user_id
    INTO v_invite
  FROM public.buddy_invites
  WHERE token = p_token
  LIMIT 1
  FOR UPDATE;

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

  v_lock_a := least(p_acceptor_id::text, v_invite.inviter_user_id::text);
  v_lock_b := greatest(p_acceptor_id::text, v_invite.inviter_user_id::text);
  PERFORM pg_advisory_xact_lock(hashtext('study_buddies_cap'), hashtext(v_lock_a));
  PERFORM pg_advisory_xact_lock(hashtext('study_buddies_cap'), hashtext(v_lock_b));

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

    IF v_acceptor_max = 0 OR v_acceptor_buddy_count >= v_acceptor_max THEN
      RETURN jsonb_build_object('ok', false, 'error', 'acceptor_buddy_limit');
    END IF;

    IF v_inviter_max = 0 OR v_inviter_buddy_count >= v_inviter_max THEN
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
