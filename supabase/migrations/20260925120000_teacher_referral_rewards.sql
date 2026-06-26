-- Teacher referral rewards (separate track on top of the existing student referrals).
--
-- 1. A teacher whose unique link refers a student earns +500 RDM when that student
--    completes onboarding (instead of the default 50 student-referrer reward).
-- 2. If that referred student activates a real (Razorpay) paid subscription within
--    30 days of the referral being credited, the teacher earns an additional +500 RDM.
--
-- Student-to-student referrals (50 / 25) and the weekly bonus are unchanged.

-- Reward amounts / window are admin-tunable via rdm_config.
INSERT INTO public.rdm_config (key, value, description) VALUES
  ('referral_teacher_signup_reward', 500, 'RDM a teacher earns when a student signs up (completes onboarding) via the teacher referral link'),
  ('referral_teacher_paid_bonus', 500, 'Extra RDM a teacher earns when their referred student activates a paid subscription within the window'),
  ('referral_teacher_paid_window_days', 30, 'Days after referral credit in which a referred student must go paid for the teacher paid bonus')
ON CONFLICT (key) DO NOTHING;

-- Track whether the referrer was a teacher and whether the paid bonus has been granted.
ALTER TABLE public.referral_attributions
  ADD COLUMN IF NOT EXISTS referrer_is_teacher boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS teacher_paid_bonus_awarded_at timestamptz;

COMMENT ON COLUMN public.referral_attributions.referrer_is_teacher IS 'True when the referrer was a teacher at claim time (drives the +500 teacher track and the paid-within-30-days bonus).';
COMMENT ON COLUMN public.referral_attributions.teacher_paid_bonus_awarded_at IS 'Set when the teacher paid-within-window bonus has been granted; guards against double crediting.';

-- Signup credit: teacher referrers get the larger reward; everything else unchanged.
CREATE OR REPLACE FUNCTION public.claim_referral_attribution(p_ref_code text, p_referee_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  v_referrer_id uuid;
  v_norm text := upper(trim(coalesce(p_ref_code, '')));
  v_week_start date;
  v_cnt bigint;
  v_new_bonus_id uuid;
  v_onboarding boolean;
  v_referrer_role text;
  v_referrer_is_teacher boolean := false;

  -- Dynamic config variables
  v_referrer_reward integer;
  v_referee_welcome integer;
  v_weekly_threshold integer;
  v_weekly_bonus_rdm integer;
  v_teacher_signup_reward integer;
BEGIN
  IF length(v_norm) = 0 THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true);
  END IF;

  IF length(v_norm) <> 7 OR v_norm !~ '^[0-9A-F]{7}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_ref');
  END IF;

  SELECT p.id, p.role INTO v_referrer_id, v_referrer_role
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

  -- Teacher referrers earn a larger signup reward (separate track from students).
  v_referrer_is_teacher := (v_referrer_role = 'teacher');
  IF v_referrer_is_teacher THEN
    SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'referral_teacher_signup_reward'), 500) INTO v_teacher_signup_reward;
    v_referrer_reward := GREATEST(0, COALESCE(v_teacher_signup_reward, 500));
  END IF;

  v_week_start := (now() AT TIME ZONE 'Asia/Kolkata')::date - (extract(isodow FROM (now() AT TIME ZONE 'Asia/Kolkata')::timestamp)::integer - 1);

  INSERT INTO public.referral_attributions (
    referee_user_id,
    referrer_user_id,
    ref_code,
    credited_week_start_ist,
    referrer_rdm,
    referee_rdm,
    referrer_is_teacher
  ) VALUES (
    p_referee_id,
    v_referrer_id,
    v_norm,
    v_week_start,
    v_referrer_reward,
    v_referee_welcome,
    v_referrer_is_teacher
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
    'weekly_bonus', (v_new_bonus_id IS NOT NULL),
    'referrer_is_teacher', v_referrer_is_teacher
  );

EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_claimed');
END;
$_$;

COMMENT ON FUNCTION public.claim_referral_attribution(text, uuid) IS 'Credits a referral once per referee after onboarding. Teacher referrers earn referral_teacher_signup_reward; students earn referral_referrer_reward. Records referrer_is_teacher for the paid-within-window teacher bonus.';

-- Paid bonus: called after a referred student activates a real Razorpay subscription.
CREATE OR REPLACE FUNCTION public.award_teacher_referral_paid_bonus(p_referee_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_referrer_id uuid;
  v_is_teacher boolean;
  v_credited_at timestamptz;
  v_already timestamptz;
  v_window_days integer;
  v_bonus integer;
  v_new_balance integer;
BEGIN
  IF p_referee_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_referee');
  END IF;

  SELECT referrer_user_id, referrer_is_teacher, credited_at, teacher_paid_bonus_awarded_at
  INTO v_referrer_id, v_is_teacher, v_credited_at, v_already
  FROM public.referral_attributions
  WHERE referee_user_id = p_referee_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'no_attribution');
  END IF;

  IF v_is_teacher IS DISTINCT FROM true THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'not_teacher_referrer');
  END IF;

  IF v_already IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'already_awarded');
  END IF;

  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'referral_teacher_paid_window_days'), 30) INTO v_window_days;

  IF now() > v_credited_at + make_interval(days => GREATEST(0, COALESCE(v_window_days, 30))) THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'window_expired');
  END IF;

  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'referral_teacher_paid_bonus'), 500) INTO v_bonus;
  v_bonus := GREATEST(0, COALESCE(v_bonus, 500));

  v_new_balance := public.add_rdm(v_referrer_id, v_bonus);

  UPDATE public.referral_attributions
  SET teacher_paid_bonus_awarded_at = now()
  WHERE referee_user_id = p_referee_id;

  RETURN jsonb_build_object(
    'ok', true,
    'awarded', true,
    'amount', v_bonus,
    'referrer_user_id', v_referrer_id,
    'balance', v_new_balance
  );
END;
$$;

ALTER FUNCTION public.award_teacher_referral_paid_bonus(uuid) OWNER TO postgres;

COMMENT ON FUNCTION public.award_teacher_referral_paid_bonus(uuid) IS 'Grants the teacher a one-time referral_teacher_paid_bonus when a referred student goes paid within referral_teacher_paid_window_days of the referral credit. Idempotent via teacher_paid_bonus_awarded_at.';

REVOKE ALL ON FUNCTION public.award_teacher_referral_paid_bonus(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.award_teacher_referral_paid_bonus(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.award_teacher_referral_paid_bonus(uuid) TO service_role;
