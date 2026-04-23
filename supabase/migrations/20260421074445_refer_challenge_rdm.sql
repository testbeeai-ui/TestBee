-- Secure claim tracking for Refer & Earn challenge rewards.
-- Tracks per-day per-challenge win/share claims and enforces the daily cap.

CREATE TABLE IF NOT EXISTS public.refer_challenge_claims (
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  claim_date date NOT NULL,
  challenge_key text NOT NULL CHECK (challenge_key IN ('5', '10', '20', '50')),
  win_claimed boolean NOT NULL DEFAULT false,
  share_claimed boolean NOT NULL DEFAULT false,
  win_claimed_at timestamptz,
  share_claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, claim_date, challenge_key)
);

COMMENT ON TABLE public.refer_challenge_claims IS 'Per-user daily challenge reward claims (win + share) for refer challenges.';
COMMENT ON COLUMN public.refer_challenge_claims.win_claimed IS 'True when win reward is already claimed for this challenge/day.';
COMMENT ON COLUMN public.refer_challenge_claims.share_claimed IS 'True when share reward is already claimed for this challenge/day.';

ALTER TABLE public.refer_challenge_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS refer_challenge_claims_select_own ON public.refer_challenge_claims;
CREATE POLICY refer_challenge_claims_select_own
ON public.refer_challenge_claims
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS refer_challenge_claims_insert_own ON public.refer_challenge_claims;
CREATE POLICY refer_challenge_claims_insert_own
ON public.refer_challenge_claims
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS refer_challenge_claims_update_own ON public.refer_challenge_claims;
CREATE POLICY refer_challenge_claims_update_own
ON public.refer_challenge_claims
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_refer_challenge_claims_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_refer_challenge_claims_updated_at ON public.refer_challenge_claims;
CREATE TRIGGER trg_touch_refer_challenge_claims_updated_at
BEFORE UPDATE ON public.refer_challenge_claims
FOR EACH ROW EXECUTE FUNCTION public.touch_refer_challenge_claims_updated_at();

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
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  SELECT COALESCE(SUM(
    (CASE WHEN c.win_claimed THEN
      CASE c.challenge_key
        WHEN '5' THEN 3
        WHEN '10' THEN 7
        WHEN '20' THEN 15
        WHEN '50' THEN 30
        ELSE 0
      END
    ELSE 0 END)
    +
    (CASE WHEN c.share_claimed THEN
      CASE c.challenge_key
        WHEN '5' THEN 2
        WHEN '10' THEN 3
        WHEN '20' THEN 5
        WHEN '50' THEN 20
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
    'daily_cap', 50,
    'claims', v_rows
  );
END;
$$;

COMMENT ON FUNCTION public.get_refer_challenge_day_status(date) IS 'Returns current user daily refer challenge rewards + claim states.';

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

  IF p_reward_type = 'win' THEN
    v_reward := CASE p_challenge_key
      WHEN '5' THEN 3
      WHEN '10' THEN 7
      WHEN '20' THEN 15
      WHEN '50' THEN 30
      ELSE 0
    END;
  ELSE
    v_reward := CASE p_challenge_key
      WHEN '5' THEN 2
      WHEN '10' THEN 3
      WHEN '20' THEN 5
      WHEN '50' THEN 20
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
        WHEN '5' THEN 3
        WHEN '10' THEN 7
        WHEN '20' THEN 15
        WHEN '50' THEN 30
        ELSE 0
      END
    ELSE 0 END)
    +
    (CASE WHEN c.share_claimed THEN
      CASE c.challenge_key
        WHEN '5' THEN 2
        WHEN '10' THEN 3
        WHEN '20' THEN 5
        WHEN '50' THEN 20
        ELSE 0
      END
    ELSE 0 END)
  ), 0)
  INTO v_daily_earned
  FROM public.refer_challenge_claims c
  WHERE c.user_id = v_uid
    AND c.claim_date = p_claim_date;

  IF v_daily_earned + v_reward > 50 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Daily challenge cap exceeded',
      'daily_earned', v_daily_earned,
      'daily_cap', 50,
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
    'daily_cap', 50,
    'rdm', COALESCE(v_new_balance, 0)
  );
END;
$$;

COMMENT ON FUNCTION public.claim_refer_challenge_reward(text, text, date) IS 'Atomically claims win/share reward once per challenge/day, enforces daily 50 RDM cap, credits profiles.rdm.';
