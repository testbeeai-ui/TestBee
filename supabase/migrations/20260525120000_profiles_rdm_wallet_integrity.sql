-- Enforce wallet integrity: clients must not be able to SET profiles.rdm directly (RLS allows own-row UPDATE).
-- Only SECURITY DEFINER helpers that set a short-lived GUC may change balances.

CREATE OR REPLACE FUNCTION public.profiles_rdm_mutation_allowed()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(NULLIF(current_setting('app.allow_profile_rdm_mutation', true), ''), '0') = '1';
$$;

CREATE OR REPLACE FUNCTION public.profiles_enforce_rdm_integrity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_default_rdm integer := 100;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT public.profiles_rdm_mutation_allowed() THEN
      IF NEW.rdm IS DISTINCT FROM v_default_rdm THEN
        NEW.rdm := v_default_rdm;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.rdm IS DISTINCT FROM NEW.rdm AND NOT public.profiles_rdm_mutation_allowed() THEN
      RAISE EXCEPTION 'RDM balance cannot be modified directly';
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_enforce_rdm_integrity_trigger ON public.profiles;
CREATE TRIGGER profiles_enforce_rdm_integrity_trigger
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_enforce_rdm_integrity();

-- add_rdm / deduct_rdm: set GUC around balance UPDATE (nested-safe restore of previous GUC).
CREATE OR REPLACE FUNCTION public.add_rdm(uid uuid, amt integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_balance integer;
  v_prev text;
BEGIN
  v_prev := NULLIF(current_setting('app.allow_profile_rdm_mutation', true), '');
  PERFORM set_config('app.allow_profile_rdm_mutation', '1', true);
  UPDATE public.profiles
  SET rdm = rdm + amt
  WHERE id = uid
  RETURNING rdm INTO new_balance;
  IF v_prev IS NULL THEN
    PERFORM set_config('app.allow_profile_rdm_mutation', '0', true);
  ELSE
    PERFORM set_config('app.allow_profile_rdm_mutation', v_prev, true);
  END IF;
  RETURN new_balance;
END;
$$;

COMMENT ON FUNCTION public.add_rdm IS 'Add RDM to a user; used for doubt/answer rewards.';

CREATE OR REPLACE FUNCTION public.deduct_rdm(uid uuid, amt integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_balance integer;
  v_prev text;
BEGIN
  v_prev := NULLIF(current_setting('app.allow_profile_rdm_mutation', true), '');
  PERFORM set_config('app.allow_profile_rdm_mutation', '1', true);
  UPDATE public.profiles
  SET rdm = rdm - amt
  WHERE id = uid AND rdm >= amt
  RETURNING rdm INTO new_balance;
  IF v_prev IS NULL THEN
    PERFORM set_config('app.allow_profile_rdm_mutation', '0', true);
  ELSE
    PERFORM set_config('app.allow_profile_rdm_mutation', v_prev, true);
  END IF;
  RETURN new_balance;
END;
$$;

COMMENT ON FUNCTION public.deduct_rdm IS 'Deduct RDM for a user; returns new balance or NULL if insufficient.';

-- Deduct escrow atomically (avoids TOCTOU vs balance check + UPDATE).
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
  v_after_deduct integer;
  v_award jsonb;
  v_post_rdm integer;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;
  v_total := GREATEST(0, p_cost_rdm) + GREATEST(0, p_bounty_rdm);
  IF v_total > 0 THEN
    v_after_deduct := public.deduct_rdm(v_user_id, v_total);
    IF v_after_deduct IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Insufficient RDM');
    END IF;
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

-- Penalty used a clamped debit; keep semantics with explicit GUC (not add_rdm).
CREATE OR REPLACE FUNCTION public.doubt_report_penalty_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_author_id uuid;
  v_prev text;
BEGIN
  SELECT COUNT(DISTINCT reporter_user_id) INTO v_count FROM public.doubt_answer_reports WHERE answer_id = NEW.answer_id;
  IF v_count >= 3 THEN
    SELECT user_id INTO v_author_id FROM public.doubt_answers WHERE id = NEW.answer_id;
    UPDATE public.doubt_answers SET hidden = true WHERE id = NEW.answer_id;
    IF v_author_id IS NOT NULL THEN
      v_prev := NULLIF(current_setting('app.allow_profile_rdm_mutation', true), '');
      PERFORM set_config('app.allow_profile_rdm_mutation', '1', true);
      UPDATE public.profiles SET rdm = GREATEST(0, rdm - 10) WHERE id = v_author_id;
      IF v_prev IS NULL THEN
        PERFORM set_config('app.allow_profile_rdm_mutation', '0', true);
      ELSE
        PERFORM set_config('app.allow_profile_rdm_mutation', v_prev, true);
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

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
    PERFORM public.add_rdm(r.user_id, r.bounty_rdm);
    UPDATE public.doubts SET bounty_rdm = 0, bounty_escrowed_at = NULL WHERE id = r.id;
    v_refunded := v_refunded + 1;
  END LOOP;
  RETURN v_refunded;
END;
$$;

COMMENT ON FUNCTION public.refund_expired_doubt_bounties IS 'Refund bounty to asker for unresolved doubts after 7 days; returns count refunded.';

-- Do not expose raw wallet mutators to browsers (would bypass business rules + economic controls).
REVOKE ALL ON FUNCTION public.add_rdm(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.deduct_rdm(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_rdm(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.deduct_rdm(uuid, integer) TO service_role;
