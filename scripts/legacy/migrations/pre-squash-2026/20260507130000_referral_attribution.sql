-- Referral attribution (Earn & Learn): audit trail + weekly IST bonus guard.
-- Ref code = first 7 hex chars of profiles.id without dashes, uppercased (see refer-earn share link).
-- RDM amounts (50 / 25 / 100) must stay in sync with lib/referralRewards.ts.

CREATE TABLE public.referral_attributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referee_user_id uuid NOT NULL UNIQUE REFERENCES public.profiles (id) ON DELETE CASCADE,
  referrer_user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  ref_code text NOT NULL,
  credited_at timestamptz NOT NULL DEFAULT now(),
  credited_week_start_ist date NOT NULL,
  referrer_rdm integer NOT NULL DEFAULT 50,
  referee_rdm integer NOT NULL DEFAULT 25,
  CONSTRAINT referral_attributions_ref_code_hex CHECK (char_length(ref_code) = 7)
);

CREATE INDEX referral_attributions_referrer_idx ON public.referral_attributions (referrer_user_id);
CREATE INDEX referral_attributions_week_idx ON public.referral_attributions (referrer_user_id, credited_week_start_ist);
CREATE INDEX referral_attributions_credited_at_idx ON public.referral_attributions (credited_at);

CREATE TABLE public.referral_weekly_bonuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  week_start_ist date NOT NULL,
  rdm_awarded integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (referrer_user_id, week_start_ist)
);

CREATE INDEX referral_weekly_bonuses_referrer_idx ON public.referral_weekly_bonuses (referrer_user_id);

ALTER TABLE public.referral_attributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_weekly_bonuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY referral_attributions_select_own ON public.referral_attributions
  FOR SELECT TO authenticated
  USING (auth.uid() = referee_user_id OR auth.uid() = referrer_user_id);

CREATE POLICY referral_weekly_bonuses_select_own ON public.referral_weekly_bonuses
  FOR SELECT TO authenticated
  USING (auth.uid() = referrer_user_id);

COMMENT ON TABLE public.referral_attributions IS 'One row per invited user (referee) ever. Inserts only via claim_referral_attribution (service_role).';
COMMENT ON COLUMN public.referral_attributions.credited_week_start_ist IS 'Monday (IST calendar) of the referral week for weekly bonus / leaderboard grouping.';
COMMENT ON TABLE public.referral_weekly_bonuses IS 'Guards +100 RDM weekly bonus once per IST Monday-week per referrer.';

-- Atomic claim: insert attribution, add_rdm, optional weekly bonus.
CREATE OR REPLACE FUNCTION public.claim_referral_attribution(p_ref_code text, p_referee_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_id uuid;
  v_norm text := upper(trim(coalesce(p_ref_code, '')));
  v_week_start date;
  v_cnt bigint;
  v_new_bonus_id uuid;
  v_onboarding boolean;
BEGIN
  IF length(v_norm) = 0 THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true);
  END IF;

  IF length(v_norm) <> 7 OR v_norm !~ '^[0-9A-F]{7}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_ref');
  END IF;

  SELECT p.id INTO v_referrer_id
  FROM public.profiles p
  WHERE upper(substr(replace(p.id::text, '-', ''), 1, 7)) = v_norm
  ORDER BY p.id
  LIMIT 1;

  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'referrer_not_found');
  END IF;

  IF v_referrer_id = p_referee_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'self_referral');
  END IF;

  SELECT onboarding_complete INTO v_onboarding FROM public.profiles WHERE id = p_referee_id;
  IF v_onboarding IS DISTINCT FROM true THEN
    RETURN jsonb_build_object('ok', false, 'error', 'onboarding_incomplete');
  END IF;

  IF EXISTS (SELECT 1 FROM public.referral_attributions WHERE referee_user_id = p_referee_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_claimed');
  END IF;

  v_week_start := (now() AT TIME ZONE 'Asia/Kolkata')::date - (extract(isodow FROM (now() AT TIME ZONE 'Asia/Kolkata')::timestamp)::integer - 1);

  INSERT INTO public.referral_attributions (
    referee_user_id,
    referrer_user_id,
    ref_code,
    credited_week_start_ist,
    referrer_rdm,
    referee_rdm
  ) VALUES (
    p_referee_id,
    v_referrer_id,
    v_norm,
    v_week_start,
    50,
    25
  );

  PERFORM public.add_rdm(v_referrer_id, 50);
  PERFORM public.add_rdm(p_referee_id, 25);

  SELECT count(*) INTO v_cnt
  FROM public.referral_attributions
  WHERE referrer_user_id = v_referrer_id
    AND credited_week_start_ist = v_week_start;

  IF v_cnt = 5 THEN
    INSERT INTO public.referral_weekly_bonuses (referrer_user_id, week_start_ist, rdm_awarded)
    VALUES (v_referrer_id, v_week_start, 100)
    ON CONFLICT (referrer_user_id, week_start_ist) DO NOTHING
    RETURNING id INTO v_new_bonus_id;

    IF v_new_bonus_id IS NOT NULL THEN
      PERFORM public.add_rdm(v_referrer_id, 100);
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'referrer_credited', true,
    'referee_credited', true,
    'weekly_bonus', (v_new_bonus_id IS NOT NULL)
  );

EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_claimed');
END;
$$;

REVOKE ALL ON FUNCTION public.claim_referral_attribution(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_referral_attribution(text, uuid) TO service_role;

COMMENT ON FUNCTION public.claim_referral_attribution IS 'Called with service_role only. Credits referral RDM and weekly bonus (5 in IST week).';
