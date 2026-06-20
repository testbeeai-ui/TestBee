-- Remove +5 RDM on answer insert.
DROP TRIGGER IF EXISTS trigger_doubt_answer_reward ON public.doubt_answers;

-- Create doubt with optional bounty: deduct cost_rdm + bounty_rdm from asker, insert doubt, set bounty_escrowed_at.
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
  RETURN jsonb_build_object('ok', true, 'id', v_new_id);
END;
$$;

COMMENT ON FUNCTION public.create_doubt_with_escrow IS 'Create doubt; deduct cost and bounty from asker; escrow bounty.';

-- On accept: (Base + Bounty) - 10% tax to answerer; farming cap 3/day; log payout; clear escrow.
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
  v_bounty integer;
  v_base integer := 10;
  v_gross integer;
  v_tax integer;
  v_net integer;
  v_payouts_today integer;
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
  SELECT da.user_id INTO v_answer_user_id FROM public.doubt_answers da WHERE da.id = p_answer_id AND da.doubt_id = p_doubt_id AND da.hidden = false;
  IF v_answer_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Answer not found for this doubt');
  END IF;

  SELECT COALESCE(bounty_rdm, 0) INTO v_bounty FROM public.doubts WHERE id = p_doubt_id;

  SELECT COUNT(*) INTO v_payouts_today FROM public.accepted_answer_payouts
  WHERE user_id = v_answer_user_id AND paid_at >= date_trunc('day', now());
  IF v_payouts_today >= 3 THEN
    v_net := 0;
  ELSE
    v_gross := v_base + COALESCE(v_bounty, 0);
    v_tax := (v_gross * 10) / 100;
    v_net := GREATEST(0, v_gross - v_tax);
  END IF;

  UPDATE public.doubt_answers SET is_accepted = false WHERE doubt_id = p_doubt_id;
  UPDATE public.doubt_answers SET is_accepted = true WHERE id = p_answer_id;
  UPDATE public.doubts SET is_resolved = true, bounty_rdm = 0, bounty_escrowed_at = NULL WHERE id = p_doubt_id;

  IF v_net > 0 THEN
    PERFORM public.add_rdm(v_answer_user_id, v_net);
    INSERT INTO public.accepted_answer_payouts (user_id, answer_id, rdm_paid) VALUES (v_answer_user_id, p_answer_id, v_net);
    UPDATE public.profiles SET lifetime_answer_rdm = lifetime_answer_rdm + v_net WHERE id = v_answer_user_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'rdm_paid', v_net);
END;
$$;

COMMENT ON FUNCTION public.accept_doubt_answer IS 'Accept answer; pay (Base+Bounty)-10%% tax to answerer; farming cap 3/day; clear escrow.';

-- Penalty: when 3 distinct reporters on an answer, set hidden and deduct 10 RDM from author.
CREATE OR REPLACE FUNCTION public.doubt_report_penalty_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_author_id uuid;
BEGIN
  SELECT COUNT(DISTINCT reporter_user_id) INTO v_count FROM public.doubt_answer_reports WHERE answer_id = NEW.answer_id;
  IF v_count >= 3 THEN
    SELECT user_id INTO v_author_id FROM public.doubt_answers WHERE id = NEW.answer_id;
    UPDATE public.doubt_answers SET hidden = true WHERE id = NEW.answer_id;
    IF v_author_id IS NOT NULL THEN
      UPDATE public.profiles SET rdm = GREATEST(0, rdm - 10) WHERE id = v_author_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_doubt_report_penalty ON public.doubt_answer_reports;
CREATE TRIGGER trigger_doubt_report_penalty
  AFTER INSERT ON public.doubt_answer_reports
  FOR EACH ROW EXECUTE FUNCTION public.doubt_report_penalty_trigger();

-- Refund expired bounties (7 days). Call from cron or Edge function.
CREATE OR REPLACE FUNCTION public.refund_expired_doubt_bounties()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_refunded integer := 0;
BEGIN
  FOR r IN
    SELECT id, user_id, bounty_rdm FROM public.doubts
    WHERE bounty_rdm > 0 AND is_resolved = false
      AND bounty_escrowed_at IS NOT NULL
      AND bounty_escrowed_at + interval '7 days' < now()
  LOOP
    UPDATE public.profiles SET rdm = rdm + r.bounty_rdm WHERE id = r.user_id;
    UPDATE public.doubts SET bounty_rdm = 0, bounty_escrowed_at = NULL WHERE id = r.id;
    v_refunded := v_refunded + 1;
  END LOOP;
  RETURN v_refunded;
END;
$$;

COMMENT ON FUNCTION public.refund_expired_doubt_bounties IS 'Refund bounty to asker for unresolved doubts after 7 days; returns count refunded.';
