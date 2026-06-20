-- Ensure award_daily_rdm accepts INSTACUE_CREATE after 20260508140000_doubt_daily_rdm_ist.sql
-- (which runs later in filename order and previously replaced the function without INSTACUE_CREATE).

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

REVOKE ALL ON FUNCTION public.award_daily_rdm(uuid, text, integer) FROM PUBLIC;

COMMENT ON FUNCTION public.award_daily_rdm(uuid, text, integer) IS 'IST-day-first RDM; includes INSTACUE_CREATE for InstaCue card creation (kept in sync after doubt migration).';
