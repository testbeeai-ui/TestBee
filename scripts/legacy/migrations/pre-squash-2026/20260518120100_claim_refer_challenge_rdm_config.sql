-- Refer challenge rewards + daily cap: single source of truth from public.rdm_config

INSERT INTO public.rdm_config (key, value, description) VALUES
  ('refer_challenge_daily_rdm_cap', 50, 'Max RDM per UTC day from refer & earn challenge win+share claims')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description;

CREATE OR REPLACE FUNCTION public.get_refer_challenge_day_status(p_claim_date date DEFAULT (now() AT TIME ZONE 'utc')::date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_daily_earned integer := 0;
  v_rows jsonb := '[]'::jsonb;
  v_daily_cap integer;
  v_c5w integer;
  v_c5s integer;
  v_c10w integer;
  v_c10s integer;
  v_c20w integer;
  v_c20s integer;
  v_c50w integer;
  v_c50s integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'refer_challenge_daily_rdm_cap'), 50) INTO v_daily_cap;
  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'challenge_5_win'), 3) INTO v_c5w;
  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'challenge_5_share'), 2) INTO v_c5s;
  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'challenge_10_win'), 7) INTO v_c10w;
  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'challenge_10_share'), 3) INTO v_c10s;
  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'challenge_20_win'), 15) INTO v_c20w;
  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'challenge_20_share'), 5) INTO v_c20s;
  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'challenge_50_win'), 30) INTO v_c50w;
  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'challenge_50_share'), 20) INTO v_c50s;

  SELECT COALESCE(SUM(
    (CASE WHEN c.win_claimed THEN
      CASE c.challenge_key
        WHEN '5' THEN v_c5w
        WHEN '10' THEN v_c10w
        WHEN '20' THEN v_c20w
        WHEN '50' THEN v_c50w
        ELSE 0
      END
    ELSE 0 END)
    +
    (CASE WHEN c.share_claimed THEN
      CASE c.challenge_key
        WHEN '5' THEN v_c5s
        WHEN '10' THEN v_c10s
        WHEN '20' THEN v_c20s
        WHEN '50' THEN v_c50s
        ELSE 0
      END
    ELSE 0 END)
  ), 0)
  INTO v_daily_earned
  FROM public.refer_challenge_claims c
  WHERE c.user_id = v_uid
    AND c.claim_date = p_claim_date;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'challenge_key', c.challenge_key,
        'win_claimed', c.win_claimed,
        'share_claimed', c.share_claimed
      )
      ORDER BY c.challenge_key
    ),
    '[]'::jsonb
  )
  INTO v_rows
  FROM public.refer_challenge_claims c
  WHERE c.user_id = v_uid
    AND c.claim_date = p_claim_date;

  RETURN jsonb_build_object(
    'ok', true,
    'claim_date', p_claim_date,
    'daily_earned', v_daily_earned,
    'daily_cap', v_daily_cap,
    'claims', v_rows
  );
END;
$$;

COMMENT ON FUNCTION public.get_refer_challenge_day_status(date) IS 'Returns current user daily refer challenge rewards + claim states (amounts from rdm_config).';

CREATE OR REPLACE FUNCTION public.claim_refer_challenge_reward(
  p_challenge_key text,
  p_reward_type text,
  p_claim_date date DEFAULT (now() AT TIME ZONE 'utc')::date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.refer_challenge_claims%ROWTYPE;
  v_reward integer := 0;
  v_daily_earned integer := 0;
  v_new_balance integer := 0;
  v_claimed_now boolean := false;
  v_daily_cap integer;
  v_c5w integer;
  v_c5s integer;
  v_c10w integer;
  v_c10s integer;
  v_c20w integer;
  v_c20s integer;
  v_c50w integer;
  v_c50s integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  IF p_challenge_key NOT IN ('5', '10', '20', '50') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid challenge key');
  END IF;
  IF p_reward_type NOT IN ('win', 'share') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid reward type');
  END IF;

  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'refer_challenge_daily_rdm_cap'), 50) INTO v_daily_cap;
  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'challenge_5_win'), 3) INTO v_c5w;
  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'challenge_5_share'), 2) INTO v_c5s;
  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'challenge_10_win'), 7) INTO v_c10w;
  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'challenge_10_share'), 3) INTO v_c10s;
  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'challenge_20_win'), 15) INTO v_c20w;
  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'challenge_20_share'), 5) INTO v_c20s;
  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'challenge_50_win'), 30) INTO v_c50w;
  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'challenge_50_share'), 20) INTO v_c50s;

  IF p_reward_type = 'win' THEN
    v_reward := CASE p_challenge_key
      WHEN '5' THEN v_c5w
      WHEN '10' THEN v_c10w
      WHEN '20' THEN v_c20w
      WHEN '50' THEN v_c50w
      ELSE 0
    END;
  ELSE
    v_reward := CASE p_challenge_key
      WHEN '5' THEN v_c5s
      WHEN '10' THEN v_c10s
      WHEN '20' THEN v_c20s
      WHEN '50' THEN v_c50s
      ELSE 0
    END;
  END IF;

  INSERT INTO public.refer_challenge_claims (user_id, claim_date, challenge_key)
  VALUES (v_uid, p_claim_date, p_challenge_key)
  ON CONFLICT (user_id, claim_date, challenge_key) DO NOTHING;

  SELECT *
  INTO v_row
  FROM public.refer_challenge_claims
  WHERE user_id = v_uid
    AND claim_date = p_claim_date
    AND challenge_key = p_challenge_key
  FOR UPDATE;

  IF p_reward_type = 'win' AND v_row.win_claimed THEN
    SELECT rdm INTO v_new_balance FROM public.profiles WHERE id = v_uid;
    RETURN jsonb_build_object(
      'ok', true,
      'claimed_now', false,
      'already_claimed', true,
      'reward_type', p_reward_type,
      'challenge_key', p_challenge_key,
      'reward_rdm', v_reward,
      'rdm', COALESCE(v_new_balance, 0)
    );
  END IF;

  IF p_reward_type = 'share' AND v_row.share_claimed THEN
    SELECT rdm INTO v_new_balance FROM public.profiles WHERE id = v_uid;
    RETURN jsonb_build_object(
      'ok', true,
      'claimed_now', false,
      'already_claimed', true,
      'reward_type', p_reward_type,
      'challenge_key', p_challenge_key,
      'reward_rdm', v_reward,
      'rdm', COALESCE(v_new_balance, 0)
    );
  END IF;

  SELECT COALESCE(SUM(
    (CASE WHEN c.win_claimed THEN
      CASE c.challenge_key
        WHEN '5' THEN v_c5w
        WHEN '10' THEN v_c10w
        WHEN '20' THEN v_c20w
        WHEN '50' THEN v_c50w
        ELSE 0
      END
    ELSE 0 END)
    +
    (CASE WHEN c.share_claimed THEN
      CASE c.challenge_key
        WHEN '5' THEN v_c5s
        WHEN '10' THEN v_c10s
        WHEN '20' THEN v_c20s
        WHEN '50' THEN v_c50s
        ELSE 0
      END
    ELSE 0 END)
  ), 0)
  INTO v_daily_earned
  FROM public.refer_challenge_claims c
  WHERE c.user_id = v_uid
    AND c.claim_date = p_claim_date;

  IF v_daily_earned + v_reward > v_daily_cap THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Daily challenge cap exceeded',
      'daily_earned', v_daily_earned,
      'daily_cap', v_daily_cap,
      'reward_rdm', v_reward
    );
  END IF;

  IF p_reward_type = 'win' THEN
    UPDATE public.refer_challenge_claims
    SET win_claimed = true, win_claimed_at = now()
    WHERE user_id = v_uid
      AND claim_date = p_claim_date
      AND challenge_key = p_challenge_key;
  ELSE
    UPDATE public.refer_challenge_claims
    SET share_claimed = true, share_claimed_at = now()
    WHERE user_id = v_uid
      AND claim_date = p_claim_date
      AND challenge_key = p_challenge_key;
  END IF;
  v_claimed_now := true;

  PERFORM public.add_rdm(v_uid, v_reward);
  SELECT rdm INTO v_new_balance FROM public.profiles WHERE id = v_uid;

  RETURN jsonb_build_object(
    'ok', true,
    'claimed_now', v_claimed_now,
    'already_claimed', false,
    'reward_type', p_reward_type,
    'challenge_key', p_challenge_key,
    'reward_rdm', v_reward,
    'daily_earned', v_daily_earned + v_reward,
    'daily_cap', v_daily_cap,
    'rdm', COALESCE(v_new_balance, 0)
  );
END;
$$;

COMMENT ON FUNCTION public.claim_refer_challenge_reward(text, text, date) IS 'Atomically claims win/share reward once per challenge/day; daily cap and reward sizes from rdm_config; credits profiles.rdm.';
