-- Gyan++: one RDM reward per action type per IST calendar day (unique claim row + server-side date).
-- Sync GYAN_BOT uuid list with lib/gyanBotPersonas.ts (ALL_GYAN_BOT_USER_IDS).

-- ─── daily_reward_claims ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.daily_reward_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action_type text NOT NULL CHECK (action_type IN ('ASK', 'COMMENT', 'UPVOTE', 'SAVE')),
  claim_date_ist date NOT NULL,
  points_awarded integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, action_type, claim_date_ist)
);

CREATE INDEX IF NOT EXISTS idx_daily_reward_claims_user_ist_date
  ON public.daily_reward_claims (user_id, claim_date_ist);

COMMENT ON TABLE public.daily_reward_claims IS 'IST-day-first reward claims; unique constraint prevents race duplicates.';

ALTER TABLE public.daily_reward_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own daily_reward_claims" ON public.daily_reward_claims;
CREATE POLICY "Users read own daily_reward_claims"
  ON public.daily_reward_claims FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE for authenticated — only SECURITY DEFINER functions/triggers.

-- ─── Gyan bot exclusion (no farming RDM for system personas) ────────────────
CREATE OR REPLACE FUNCTION public.is_gyan_bot_user(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT p_user_id IN (
    'f2a00000-0000-4000-8000-000000000001'::uuid,
    'f2a00000-0000-4000-8000-000000000002'::uuid,
    'f2a00000-0000-4000-8000-000000000003'::uuid,
    'f2a00000-0000-4000-8000-000000000004'::uuid,
    'f2a00000-0000-4000-8000-000000000005'::uuid,
    'f2a00000-0000-4000-8000-000000000006'::uuid,
    'f2a00000-0000-4000-8000-000000000007'::uuid,
    'f2a00000-0000-4000-8000-000000000008'::uuid,
    'f2a00000-0000-4000-8000-000000000009'::uuid,
    'f2a00000-0000-4000-8000-00000000000a'::uuid,
    'f2a00000-0000-4000-8000-00000000000b'::uuid,
    'f2a00000-0000-4000-8000-00000000000c'::uuid,
    'f2a00000-0000-4000-8000-00000000000d'::uuid
  );
$$;

-- ─── Core award helper (internal — not exposed to clients) ─────────────────
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
  IF p_action_type NOT IN ('ASK', 'COMMENT', 'UPVOTE', 'SAVE') THEN
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

COMMENT ON FUNCTION public.award_daily_rdm IS 'IST-day-first RDM; uses unique claim row — not callable by clients.';

-- ─── Optional: total earned today (IST) for dashboard ────────────────────────
CREATE OR REPLACE FUNCTION public.get_daily_rdm_earned_ist()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(c.points_awarded), 0)::integer
  FROM public.daily_reward_claims c
  WHERE c.user_id = auth.uid()
    AND c.claim_date_ist = ((now() AT TIME ZONE 'Asia/Kolkata'))::date;
$$;

REVOKE ALL ON FUNCTION public.get_daily_rdm_earned_ist() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_daily_rdm_earned_ist() TO authenticated;

COMMENT ON FUNCTION public.get_daily_rdm_earned_ist IS 'Sum of IST-day daily milestone RDM for current user.';

-- ─── create_doubt_with_escrow: +5 ASK (first qualifying post per IST day) ──
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

  v_award := public.award_daily_rdm(v_user_id, 'ASK', 5);

  RETURN jsonb_build_object('ok', true, 'id', v_new_id, 'daily_rdm', v_award);
END;
$$;

COMMENT ON FUNCTION public.create_doubt_with_escrow IS 'Create doubt; deduct cost/bounty; IST daily +5 ASK reward once/day.';

-- ─── vote_on_doubt: +2 UPVOTE for voter once per IST day (transition onto upvote) ──
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
        v_voter_award := public.award_daily_rdm(v_user_id, 'UPVOTE', 2);
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
      v_voter_award := public.award_daily_rdm(v_user_id, 'UPVOTE', 2);
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

COMMENT ON FUNCTION public.vote_on_doubt IS 'Votes; owner RDM + voter IST daily upvote bonus (+2 once/day).';

-- ─── COMMENT: +5 on first student answer row per IST day ───────────────────
CREATE OR REPLACE FUNCTION public.doubt_answer_daily_rdm_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _unused jsonb;
BEGIN
  IF public.is_gyan_bot_user(NEW.user_id) THEN
    RETURN NEW;
  END IF;
  _unused := public.award_daily_rdm(NEW.user_id, 'COMMENT', 5);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_doubt_answer_daily_rdm ON public.doubt_answers;
CREATE TRIGGER trigger_doubt_answer_daily_rdm
  AFTER INSERT ON public.doubt_answers
  FOR EACH ROW EXECUTE FUNCTION public.doubt_answer_daily_rdm_trigger();

-- ─── SAVE: +3 on first doubt save per IST day ──────────────────────────────
CREATE OR REPLACE FUNCTION public.doubt_save_daily_rdm_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _unused jsonb;
BEGIN
  IF public.is_gyan_bot_user(NEW.user_id) THEN
    RETURN NEW;
  END IF;
  _unused := public.award_daily_rdm(NEW.user_id, 'SAVE', 3);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_doubt_save_daily_rdm ON public.doubt_saves;
CREATE TRIGGER trigger_doubt_save_daily_rdm
  AFTER INSERT ON public.doubt_saves
  FOR EACH ROW EXECUTE FUNCTION public.doubt_save_daily_rdm_trigger();
