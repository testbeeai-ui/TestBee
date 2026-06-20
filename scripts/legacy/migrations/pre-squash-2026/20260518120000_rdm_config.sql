-- 1. Create the rdm_config table
CREATE TABLE IF NOT EXISTS public.rdm_config (
  key text PRIMARY KEY,
  value integer NOT NULL,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Insert default configuration values
INSERT INTO public.rdm_config (key, value, description) VALUES
  ('referral_referrer_reward', 50, 'RDM per referral'),
  ('referral_referee_welcome', 25, 'Welcome Bonus for referee'),
  ('referral_weekly_bonus_threshold', 5, 'Weekly Bonus Threshold (number of referrals)'),
  ('referral_weekly_bonus_rdm', 100, 'Weekly Bonus RDM'),
  ('challenge_5_win', 3, 'MentaMill Blitz Win Reward'),
  ('challenge_5_share', 2, 'MentaMill Blitz Share Reward'),
  ('challenge_10_win', 7, 'FunBrain Quiz Win Reward'),
  ('challenge_10_share', 3, 'FunBrain Quiz Share Reward'),
  ('challenge_20_win', 15, 'Academic Arena Win Reward'),
  ('challenge_20_share', 5, 'Academic Arena Share Reward'),
  ('challenge_50_win', 30, 'Academic Arena Pro Win Reward'),
  ('challenge_50_share', 20, 'Academic Arena Pro Share Reward')
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  description = EXCLUDED.description;

-- 3. Setup trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_rdm_config_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rdm_config_updated_at ON public.rdm_config;
CREATE TRIGGER trg_rdm_config_updated_at
  BEFORE UPDATE ON public.rdm_config
  FOR EACH ROW
  EXECUTE FUNCTION public.set_rdm_config_updated_at();

-- 4. Set up RLS for rdm_config
ALTER TABLE public.rdm_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rdm_config_select_all ON public.rdm_config;
CREATE POLICY rdm_config_select_all ON public.rdm_config
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS rdm_config_update_admin ON public.rdm_config;
CREATE POLICY rdm_config_update_admin ON public.rdm_config
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

COMMENT ON TABLE public.rdm_config IS 'Dynamic configuration for RDM rewards (referrals, challenges, etc.). Editable by admins.';

-- 5. Update claim_referral_attribution to read from rdm_config
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
  
  -- Dynamic config variables
  v_referrer_reward integer;
  v_referee_welcome integer;
  v_weekly_threshold integer;
  v_weekly_bonus_rdm integer;
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

  -- Load dynamic configuration
  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'referral_referrer_reward'), 50) INTO v_referrer_reward;
  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'referral_referee_welcome'), 25) INTO v_referee_welcome;
  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'referral_weekly_bonus_threshold'), 5) INTO v_weekly_threshold;
  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'referral_weekly_bonus_rdm'), 100) INTO v_weekly_bonus_rdm;

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
    v_referrer_reward,
    v_referee_welcome
  );

  PERFORM public.add_rdm(v_referrer_id, v_referrer_reward);
  PERFORM public.add_rdm(p_referee_id, v_referee_welcome);

  SELECT count(*) INTO v_cnt
  FROM public.referral_attributions
  WHERE referrer_user_id = v_referrer_id
    AND credited_week_start_ist = v_week_start;

  IF v_cnt = v_weekly_threshold THEN
    INSERT INTO public.referral_weekly_bonuses (referrer_user_id, week_start_ist, rdm_awarded)
    VALUES (v_referrer_id, v_week_start, v_weekly_bonus_rdm)
    ON CONFLICT (referrer_user_id, week_start_ist) DO NOTHING
    RETURNING id INTO v_new_bonus_id;

    IF v_new_bonus_id IS NOT NULL THEN
      PERFORM public.add_rdm(v_referrer_id, v_weekly_bonus_rdm);
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
