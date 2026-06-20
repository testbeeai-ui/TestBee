-- Add RDM to a user (for doubts rewards). Returns new balance.
CREATE OR REPLACE FUNCTION public.add_rdm(uid uuid, amt integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_balance integer;
BEGIN
  UPDATE public.profiles
  SET rdm = rdm + amt
  WHERE id = uid
  RETURNING rdm INTO new_balance;
  RETURN new_balance;
END;
$$;

COMMENT ON FUNCTION public.add_rdm IS 'Add RDM to a user; used for doubt/answer rewards.';

-- Award +5 RDM to answerer when a new doubt_answers row is inserted.
CREATE OR REPLACE FUNCTION public.doubt_answer_reward_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.add_rdm(NEW.user_id, 5);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_doubt_answer_reward ON public.doubt_answers;
CREATE TRIGGER trigger_doubt_answer_reward
  AFTER INSERT ON public.doubt_answers
  FOR EACH ROW EXECUTE FUNCTION public.doubt_answer_reward_trigger();

-- Vote on a doubt or answer: upsert vote, update counts, apply RDM.
-- If changing vote (e.g. up to down), we need to reverse previous RDM then apply new.
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
  v_doubt_user_id uuid;
  v_answer_user_id uuid;
  v_owner_id uuid;
  v_prev_count_up integer;
  v_prev_count_down integer;
BEGIN
  IF v_user_id IS NULL OR p_vote_type NOT IN (1, -1) OR p_target_type NOT IN ('doubt', 'answer') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid input');
  END IF;

  IF p_target_type = 'doubt' THEN
    SELECT user_id INTO v_owner_id FROM public.doubts WHERE id = p_target_id;
    IF v_owner_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Doubt not found');
    END IF;
    SELECT COALESCE(vote_type, 0) INTO v_prev_vote FROM public.doubt_votes
      WHERE user_id = v_user_id AND target_type = 'doubt' AND target_id = p_target_id;
    SELECT upvotes, downvotes INTO v_prev_count_up, v_prev_count_down FROM public.doubts WHERE id = p_target_id;

    -- Remove previous vote record if any
    DELETE FROM public.doubt_votes WHERE user_id = v_user_id AND target_type = 'doubt' AND target_id = p_target_id;

    -- Reverse previous RDM for asker: upvote gave +1, downvote gave -0 (plan says only upvote gives +1 to asker)
    IF v_prev_vote = 1 THEN
      PERFORM public.add_rdm(v_owner_id, -1);
    END IF;

    -- Insert new vote
    INSERT INTO public.doubt_votes (user_id, target_type, target_id, vote_type)
    VALUES (v_user_id, 'doubt', p_target_id, p_vote_type);

    -- Update doubt counts
    IF v_prev_vote = 1 THEN
      v_prev_count_up := v_prev_count_up - 1;
    ELSIF v_prev_vote = -1 THEN
      v_prev_count_down := v_prev_count_down - 1;
    END IF;
    IF p_vote_type = 1 THEN
      v_prev_count_up := v_prev_count_up + 1;
      PERFORM public.add_rdm(v_owner_id, 1);
    ELSE
      v_prev_count_down := v_prev_count_down + 1;
    END IF;
    UPDATE public.doubts SET upvotes = v_prev_count_up, downvotes = v_prev_count_down WHERE id = p_target_id;

    RETURN jsonb_build_object('ok', true, 'upvotes', v_prev_count_up, 'downvotes', v_prev_count_down);
  END IF;

  -- p_target_type = 'answer'
  SELECT da.user_id INTO v_answer_user_id FROM public.doubt_answers da WHERE da.id = p_target_id;
  IF v_answer_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Answer not found');
  END IF;

  SELECT COALESCE(vote_type, 0) INTO v_prev_vote FROM public.doubt_votes
    WHERE user_id = v_user_id AND target_type = 'answer' AND target_id = p_target_id;
  SELECT upvotes, downvotes INTO v_prev_count_up, v_prev_count_down FROM public.doubt_answers WHERE id = p_target_id;

  DELETE FROM public.doubt_votes WHERE user_id = v_user_id AND target_type = 'answer' AND target_id = p_target_id;

  -- Reverse previous RDM: upvote +2, downvote -1
  IF v_prev_vote = 1 THEN
    PERFORM public.add_rdm(v_answer_user_id, -2);
  ELSIF v_prev_vote = -1 THEN
    PERFORM public.add_rdm(v_answer_user_id, 1);
  END IF;

  INSERT INTO public.doubt_votes (user_id, target_type, target_id, vote_type)
  VALUES (v_user_id, 'answer', p_target_id, p_vote_type);

  IF v_prev_vote = 1 THEN
    v_prev_count_up := v_prev_count_up - 1;
  ELSIF v_prev_vote = -1 THEN
    v_prev_count_down := v_prev_count_down - 1;
  END IF;
  IF p_vote_type = 1 THEN
    v_prev_count_up := v_prev_count_up + 1;
    PERFORM public.add_rdm(v_answer_user_id, 2);
  ELSE
    v_prev_count_down := v_prev_count_down + 1;
    PERFORM public.add_rdm(v_answer_user_id, -1);
  END IF;
  UPDATE public.doubt_answers SET upvotes = v_prev_count_up, downvotes = v_prev_count_down WHERE id = p_target_id;

  RETURN jsonb_build_object('ok', true, 'upvotes', v_prev_count_up, 'downvotes', v_prev_count_down);
END;
$$;

COMMENT ON FUNCTION public.vote_on_doubt IS 'Record vote on doubt or answer; updates counts and RDM.';

-- Accept an answer (doubt author only). Sets is_accepted on answer, is_resolved on doubt. Optional bonus RDM to answerer.
CREATE OR REPLACE FUNCTION public.accept_doubt_answer(p_doubt_id uuid, p_answer_id uuid, p_bonus_rdm integer DEFAULT 10)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_doubt_user_id uuid;
  v_answer_user_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;
  SELECT user_id INTO v_doubt_user_id FROM public.doubts WHERE id = p_doubt_id;
  IF v_doubt_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Doubt not found');
  END IF;
  IF v_doubt_user_id != v_user_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only the question author can accept an answer');
  END IF;
  SELECT user_id INTO v_answer_user_id FROM public.doubt_answers WHERE id = p_answer_id AND doubt_id = p_doubt_id;
  IF v_answer_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Answer not found for this doubt');
  END IF;

  -- Unaccept any previously accepted answer
  UPDATE public.doubt_answers SET is_accepted = false WHERE doubt_id = p_doubt_id;
  -- Accept this answer
  UPDATE public.doubt_answers SET is_accepted = true WHERE id = p_answer_id;
  UPDATE public.doubts SET is_resolved = true WHERE id = p_doubt_id;

  IF p_bonus_rdm > 0 THEN
    PERFORM public.add_rdm(v_answer_user_id, p_bonus_rdm);
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

COMMENT ON FUNCTION public.accept_doubt_answer IS 'Mark an answer as accepted and optionally award bonus RDM to answerer.';
