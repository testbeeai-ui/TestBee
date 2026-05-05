-- Gyan++ RDM values managed from rdm_config and used by wallet awards + UI copy.

INSERT INTO public.rdm_config (key, value, description)
VALUES
  ('gyan_post_rdm', 5, 'Gyan++ · Ask/Post daily milestone RDM (first ASK per IST day)'),
  ('gyan_comment_rdm', 5, 'Gyan++ · Student comment daily milestone RDM (first COMMENT per IST day)'),
  ('gyan_upvote_rdm', 2, 'Gyan++ · Voter first upvote daily milestone RDM (first UPVOTE per IST day)'),
  ('gyan_save_rdm', 3, 'Gyan++ · Save for revision daily milestone RDM (first SAVE per IST day)'),
  ('gyan_teacher_answer_rdm', 30, 'Gyan++ · Teacher section reward shown in feed/wall UI')
ON CONFLICT (key) DO UPDATE
SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = now();

CREATE OR REPLACE FUNCTION public.create_doubt_with_escrow(
  p_title text,
  p_body text,
  p_subject text,
  p_cost_rdm integer DEFAULT 0,
  p_bounty_rdm integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_total integer;
  v_new_id uuid;
  v_balance integer;
  v_award jsonb;
  v_post_rdm integer;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;
  v_total := GREATEST(0, p_cost_rdm) + GREATEST(0, p_bounty_rdm);
  IF v_total > 0 THEN
    SELECT rdm INTO v_balance FROM public.profiles WHERE id = v_user_id;
    IF (v_balance IS NULL OR v_balance < v_total) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Insufficient RDM');
    END IF;
    UPDATE public.profiles SET rdm = rdm - v_total WHERE id = v_user_id;
  END IF;
  INSERT INTO public.doubts (user_id, title, body, subject, cost_rdm, bounty_rdm, bounty_escrowed_at)
  VALUES (
    v_user_id,
    p_title,
    COALESCE(p_body, ''),
    NULLIF(trim(p_subject), ''),
    GREATEST(0, p_cost_rdm),
    GREATEST(0, p_bounty_rdm),
    CASE WHEN GREATEST(0, p_bounty_rdm) > 0 THEN now() ELSE NULL END
  )
  RETURNING id INTO v_new_id;

  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'gyan_post_rdm'), 5)
  INTO v_post_rdm;
  v_post_rdm := GREATEST(1, v_post_rdm);
  v_award := public.award_daily_rdm(v_user_id, 'ASK', v_post_rdm);

  RETURN jsonb_build_object('ok', true, 'id', v_new_id, 'daily_rdm', v_award);
END;
$$;

COMMENT ON FUNCTION public.create_doubt_with_escrow IS
  'Create doubt; deduct cost/bounty; IST daily ASK reward driven by rdm_config.gyan_post_rdm.';

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

    IF v_prev_vote = 1 THEN
      PERFORM public.add_rdm(v_owner_id, -1);
    END IF;

    INSERT INTO public.doubt_votes (user_id, target_type, target_id, vote_type)
    VALUES (v_user_id, 'doubt', p_target_id, p_vote_type);

    IF v_prev_vote = 1 THEN
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
    UPDATE public.doubts SET upvotes = v_prev_count_up, downvotes = v_prev_count_down WHERE id = p_target_id;

    RETURN jsonb_build_object(
      'ok', true,
      'upvotes', v_prev_count_up,
      'downvotes', v_prev_count_down,
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
    IF v_prev_vote IS DISTINCT FROM 1 THEN
      v_voter_award := public.award_daily_rdm(v_user_id, 'UPVOTE', v_upvote_rdm);
    END IF;
  ELSE
    v_prev_count_down := v_prev_count_down + 1;
    PERFORM public.add_rdm(v_answer_user_id, -1);
  END IF;
  UPDATE public.doubt_answers SET upvotes = v_prev_count_up, downvotes = v_prev_count_down WHERE id = p_target_id;

  RETURN jsonb_build_object(
    'ok', true,
    'upvotes', v_prev_count_up,
    'downvotes', v_prev_count_down,
    'voter_daily_rdm', COALESCE(v_voter_award, jsonb_build_object('awarded', false))
  );
END;
$$;

COMMENT ON FUNCTION public.vote_on_doubt IS
  'Votes; owner RDM + voter IST daily upvote bonus from rdm_config.gyan_upvote_rdm.';

CREATE OR REPLACE FUNCTION public.doubt_answer_daily_rdm_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _unused jsonb;
  v_role text;
  v_points integer;
BEGIN
  IF public.is_gyan_bot_user(NEW.user_id) THEN
    RETURN NEW;
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = NEW.user_id;
  IF v_role = 'teacher' THEN
    SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'gyan_teacher_answer_rdm'), 30)
    INTO v_points;
  ELSE
    SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'gyan_comment_rdm'), 5)
    INTO v_points;
  END IF;

  v_points := GREATEST(1, v_points);
  _unused := public.award_daily_rdm(NEW.user_id, 'COMMENT', v_points);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.doubt_save_daily_rdm_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _unused jsonb;
  v_points integer;
BEGIN
  IF public.is_gyan_bot_user(NEW.user_id) THEN
    RETURN NEW;
  END IF;
  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'gyan_save_rdm'), 3)
  INTO v_points;
  v_points := GREATEST(1, v_points);
  _unused := public.award_daily_rdm(NEW.user_id, 'SAVE', v_points);
  RETURN NEW;
END;
$$;
