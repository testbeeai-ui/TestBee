-- Toggle off when the same vote type is sent again (LinkedIn-style Like / Unlike).

CREATE OR REPLACE FUNCTION public.vote_on_doubt(
  p_target_type text,
  p_target_id uuid,
  p_vote_type integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_prev_vote integer;
  v_answer_user_id uuid;
  v_owner_id uuid;
  v_prev_count_up integer;
  v_prev_count_down integer;
  v_voter_award jsonb;
  v_upvote_rdm integer;
  v_new_user_vote integer := 0;
BEGIN
  IF v_user_id IS NULL OR p_vote_type NOT IN (1, -1) OR p_target_type NOT IN ('doubt', 'answer') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid input');
  END IF;

  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'gyan_upvote_rdm'), 2)
  INTO v_upvote_rdm;
  v_upvote_rdm := GREATEST(1, v_upvote_rdm);

  IF p_target_type = 'doubt' THEN
    SELECT user_id INTO v_owner_id FROM public.doubts WHERE id = p_target_id;
    IF v_owner_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Doubt not found');
    END IF;
    SELECT COALESCE(vote_type, 0) INTO v_prev_vote FROM public.doubt_votes
      WHERE user_id = v_user_id AND target_type = 'doubt' AND target_id = p_target_id;
    v_prev_vote := COALESCE(v_prev_vote, 0);
    SELECT upvotes, downvotes INTO v_prev_count_up, v_prev_count_down FROM public.doubts WHERE id = p_target_id;

    DELETE FROM public.doubt_votes WHERE user_id = v_user_id AND target_type = 'doubt' AND target_id = p_target_id;

    IF v_prev_vote = p_vote_type THEN
      IF v_prev_vote = 1 THEN
        PERFORM public.add_rdm(v_owner_id, -1);
        v_prev_count_up := v_prev_count_up - 1;
      ELSIF v_prev_vote = -1 THEN
        v_prev_count_down := v_prev_count_down - 1;
      END IF;
      v_new_user_vote := 0;
    ELSE
      INSERT INTO public.doubt_votes (user_id, target_type, target_id, vote_type)
      VALUES (v_user_id, 'doubt', p_target_id, p_vote_type);

      IF v_prev_vote = 1 THEN
        PERFORM public.add_rdm(v_owner_id, -1);
        v_prev_count_up := v_prev_count_up - 1;
      ELSIF v_prev_vote = -1 THEN
        v_prev_count_down := v_prev_count_down - 1;
      END IF;
      IF p_vote_type = 1 THEN
        v_prev_count_up := v_prev_count_up + 1;
        PERFORM public.add_rdm(v_owner_id, 1);
        IF v_prev_vote IS DISTINCT FROM 1 THEN
          v_voter_award := public.award_daily_rdm(v_user_id, 'UPVOTE', v_upvote_rdm);
        END IF;
      ELSE
        v_prev_count_down := v_prev_count_down + 1;
      END IF;
      v_new_user_vote := p_vote_type;
    END IF;

    UPDATE public.doubts SET upvotes = v_prev_count_up, downvotes = v_prev_count_down WHERE id = p_target_id;

    RETURN jsonb_build_object(
      'ok', true,
      'upvotes', v_prev_count_up,
      'downvotes', v_prev_count_down,
      'user_vote', v_new_user_vote,
      'voter_daily_rdm', COALESCE(v_voter_award, jsonb_build_object('awarded', false))
    );
  END IF;

  SELECT da.user_id INTO v_answer_user_id FROM public.doubt_answers da WHERE da.id = p_target_id;
  IF v_answer_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Answer not found');
  END IF;

  SELECT COALESCE(vote_type, 0) INTO v_prev_vote FROM public.doubt_votes
    WHERE user_id = v_user_id AND target_type = 'answer' AND target_id = p_target_id;
  v_prev_vote := COALESCE(v_prev_vote, 0);
  SELECT upvotes, downvotes INTO v_prev_count_up, v_prev_count_down FROM public.doubt_answers WHERE id = p_target_id;

  DELETE FROM public.doubt_votes WHERE user_id = v_user_id AND target_type = 'answer' AND target_id = p_target_id;

  IF v_prev_vote = p_vote_type THEN
    IF v_prev_vote = 1 THEN
      PERFORM public.add_rdm(v_answer_user_id, -2);
      v_prev_count_up := v_prev_count_up - 1;
    ELSIF v_prev_vote = -1 THEN
      PERFORM public.add_rdm(v_answer_user_id, 1);
      v_prev_count_down := v_prev_count_down - 1;
    END IF;
    v_new_user_vote := 0;
  ELSE
    INSERT INTO public.doubt_votes (user_id, target_type, target_id, vote_type)
    VALUES (v_user_id, 'answer', p_target_id, p_vote_type);

    IF v_prev_vote = 1 THEN
      PERFORM public.add_rdm(v_answer_user_id, -2);
      v_prev_count_up := v_prev_count_up - 1;
    ELSIF v_prev_vote = -1 THEN
      PERFORM public.add_rdm(v_answer_user_id, 1);
      v_prev_count_down := v_prev_count_down - 1;
    END IF;
    IF p_vote_type = 1 THEN
      v_prev_count_up := v_prev_count_up + 1;
      PERFORM public.add_rdm(v_answer_user_id, 2);
      IF v_prev_vote IS DISTINCT FROM 1 THEN
        v_voter_award := public.award_daily_rdm(v_user_id, 'UPVOTE', v_upvote_rdm);
      END IF;
    ELSE
      v_prev_count_down := v_prev_count_down + 1;
      PERFORM public.add_rdm(v_answer_user_id, -1);
    END IF;
    v_new_user_vote := p_vote_type;
  END IF;

  UPDATE public.doubt_answers SET upvotes = v_prev_count_up, downvotes = v_prev_count_down WHERE id = p_target_id;

  RETURN jsonb_build_object(
    'ok', true,
    'upvotes', v_prev_count_up,
    'downvotes', v_prev_count_down,
    'user_vote', v_new_user_vote,
    'voter_daily_rdm', COALESCE(v_voter_award, jsonb_build_object('awarded', false))
  );
END;
$$;

COMMENT ON FUNCTION public.vote_on_doubt IS
  'Vote or toggle off (same type again removes vote). Returns user_vote (0 = none).';
