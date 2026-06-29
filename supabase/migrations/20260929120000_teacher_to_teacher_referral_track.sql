-- Split teacher growth referrals: teacher→teacher (hero) vs teacher→student (student referral section).

ALTER TABLE public.referral_attributions
  ADD COLUMN IF NOT EXISTS referee_is_teacher boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.referral_attributions.referee_is_teacher IS
  'True when the referee was a teacher at claim time (teacher-referral track). False = student referral via teacher link.';

UPDATE public.referral_attributions ra
SET referee_is_teacher = (lower(trim(coalesce(p.role, ''))) = 'teacher')
FROM public.profiles p
WHERE p.id = ra.referee_user_id;

INSERT INTO public.rdm_config (key, value, description) VALUES
  (
    'referral_teacher_student_signup_reward',
    500,
    'RDM a teacher earns when a student (not teacher) signs up via the teacher referral link'
  )
ON CONFLICT (key) DO NOTHING;

UPDATE public.rdm_config
SET description = 'RDM a teacher earns when another teacher signs up (completes onboarding) via the teacher referral link'
WHERE key = 'referral_teacher_signup_reward';

UPDATE public.rdm_config
SET description = 'Extra RDM when a referred teacher or student (teacher referrer) activates paid within the window'
WHERE key = 'referral_teacher_paid_bonus';

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
  v_referee_role text;
  v_referrer_is_teacher boolean := false;
  v_referee_is_teacher boolean := false;

  v_referrer_reward integer;
  v_referee_welcome integer;
  v_weekly_threshold integer;
  v_weekly_bonus_rdm integer;
  v_teacher_signup_reward integer;
  v_teacher_student_signup_reward integer;
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

  SELECT onboarding_complete, role INTO v_onboarding, v_referee_role
  FROM public.profiles
  WHERE id = p_referee_id;

  IF v_onboarding IS DISTINCT FROM true THEN
    RETURN jsonb_build_object('ok', false, 'error', 'onboarding_incomplete');
  END IF;

  IF EXISTS (SELECT 1 FROM public.referral_attributions WHERE referee_user_id = p_referee_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_claimed');
  END IF;

  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'referral_referrer_reward'), 50)
  INTO v_referrer_reward;
  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'referral_referee_welcome'), 25)
  INTO v_referee_welcome;
  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'referral_weekly_bonus_threshold'), 5)
  INTO v_weekly_threshold;
  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'referral_weekly_bonus_rdm'), 100)
  INTO v_weekly_bonus_rdm;

  v_referrer_is_teacher := (lower(trim(coalesce(v_referrer_role, ''))) = 'teacher');
  v_referee_is_teacher := (lower(trim(coalesce(v_referee_role, ''))) = 'teacher');

  IF v_referrer_is_teacher THEN
    IF v_referee_is_teacher THEN
      SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'referral_teacher_signup_reward'), 500)
      INTO v_teacher_signup_reward;
      v_referrer_reward := GREATEST(0, COALESCE(v_teacher_signup_reward, 500));
    ELSE
      SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'referral_teacher_student_signup_reward'), 500)
      INTO v_teacher_student_signup_reward;
      v_referrer_reward := GREATEST(0, COALESCE(v_teacher_student_signup_reward, 500));
    END IF;
  END IF;

  v_week_start := (now() AT TIME ZONE 'Asia/Kolkata')::date
    - (extract(isodow FROM (now() AT TIME ZONE 'Asia/Kolkata')::timestamp)::integer - 1);

  INSERT INTO public.referral_attributions (
    referee_user_id,
    referrer_user_id,
    ref_code,
    credited_week_start_ist,
    referrer_rdm,
    referee_rdm,
    referrer_is_teacher,
    referee_is_teacher
  ) VALUES (
    p_referee_id,
    v_referrer_id,
    v_norm,
    v_week_start,
    v_referrer_reward,
    v_referee_welcome,
    v_referrer_is_teacher,
    v_referee_is_teacher
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
    'referrer_is_teacher', v_referrer_is_teacher,
    'referee_is_teacher', v_referee_is_teacher
  );

EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_claimed');
END;
$_$;

COMMENT ON FUNCTION public.claim_referral_attribution(text, uuid) IS
  'Credits referral RDM after onboarding. Teacher→teacher uses referral_teacher_signup_reward; teacher→student uses referral_teacher_student_signup_reward; student referrers use referral_referrer_reward.';

COMMENT ON FUNCTION public.award_teacher_referral_paid_bonus(uuid) IS
  'Grants referral_teacher_paid_bonus when a referred user (teacher or student) goes paid within referral_teacher_paid_window_days; referrer must be a teacher.';
