-- InstaCue: +5 RDM on first user-created revision card per IST day (reuse daily_reward_claims + award_daily_rdm).

ALTER TABLE public.daily_reward_claims DROP CONSTRAINT IF EXISTS daily_reward_claims_action_type_check;
ALTER TABLE public.daily_reward_claims
  ADD CONSTRAINT daily_reward_claims_action_type_check
  CHECK (action_type IN ('ASK', 'COMMENT', 'UPVOTE', 'SAVE', 'INSTACUE_CREATE'));

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
  IF p_action_type NOT IN ('ASK', 'COMMENT', 'UPVOTE', 'SAVE', 'INSTACUE_CREATE') THEN
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

COMMENT ON FUNCTION public.award_daily_rdm(uuid, text, integer) IS 'IST-day-first RDM; action types include INSTACUE_CREATE for InstaCue card creation.';

CREATE OR REPLACE FUNCTION public.claim_instacue_create_daily_rdm()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object(
      'awarded', false,
      'amount', 0,
      'balance', NULL,
      'reason', 'not_authenticated'
    );
  END IF;
  RETURN public.award_daily_rdm(v_uid, 'INSTACUE_CREATE', 5);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_instacue_create_daily_rdm() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_instacue_create_daily_rdm() TO authenticated;

COMMENT ON FUNCTION public.claim_instacue_create_daily_rdm IS 'First InstaCue (revision) card create per IST day: +5 RDM via award_daily_rdm.';
