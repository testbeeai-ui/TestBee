-- EduDeca referral codes: ED-{YY}{D}{L}{D}{L}{D}{L}{D}{L}
-- Separate from Student ID EB-{YY}{L}{D}{L}{D}{L}{D} — patterns never overlap.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS edudeca_referral_code text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_edudeca_referral_code_uidx
  ON public.profiles (edudeca_referral_code)
  WHERE edudeca_referral_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.edudeca_referral_codes_issued (
  referral_code text PRIMARY KEY,
  year_yy smallint NOT NULL,
  profile_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.edudeca_referral_codes_issued ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.edudeca_referral_codes_issued FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.edudeca_referral_codes_issued TO service_role;

CREATE INDEX IF NOT EXISTS edudeca_referral_codes_issued_year_yy_idx
  ON public.edudeca_referral_codes_issued (year_yy);

CREATE TABLE IF NOT EXISTS public.edudeca_referral_attributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referee_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ref_code text NOT NULL,
  credited_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT edudeca_referral_attributions_referee_user_id_key UNIQUE (referee_user_id),
  CONSTRAINT edudeca_referral_attributions_no_self CHECK (referrer_user_id <> referee_user_id)
);

CREATE INDEX IF NOT EXISTS edudeca_referral_attributions_referrer_idx
  ON public.edudeca_referral_attributions (referrer_user_id, credited_at DESC);

ALTER TABLE public.edudeca_referral_attributions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS edudeca_referral_attributions_select_own ON public.edudeca_referral_attributions;
CREATE POLICY edudeca_referral_attributions_select_own
  ON public.edudeca_referral_attributions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = referrer_user_id OR auth.uid() = referee_user_id);

REVOKE ALL ON TABLE public.edudeca_referral_attributions FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.edudeca_referral_attributions TO authenticated;
GRANT ALL ON TABLE public.edudeca_referral_attributions TO service_role;

CREATE OR REPLACE FUNCTION public.allocate_edudeca_referral_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  yy smallint;
  letters text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  suffix text;
  candidate text;
  attempt int := 0;
BEGIN
  yy := EXTRACT(YEAR FROM (now() AT TIME ZONE 'Asia/Kolkata'))::int % 100;

  LOOP
    attempt := attempt + 1;
    IF attempt > 64 THEN
      RAISE EXCEPTION 'could not allocate a unique EduDeca referral code after % attempts', attempt;
    END IF;

    -- Digit-first after YY (unlike EB Student ID which is letter-first).
    suffix :=
      (floor(random() * 10)::int)::text ||
      substr(letters, 1 + floor(random() * 26)::int, 1) ||
      (floor(random() * 10)::int)::text ||
      substr(letters, 1 + floor(random() * 26)::int, 1) ||
      (floor(random() * 10)::int)::text ||
      substr(letters, 1 + floor(random() * 26)::int, 1) ||
      (floor(random() * 10)::int)::text ||
      substr(letters, 1 + floor(random() * 26)::int, 1);

    candidate := 'ED-' || lpad(yy::text, 2, '0') || suffix;

    BEGIN
      INSERT INTO public.edudeca_referral_codes_issued (referral_code, year_yy)
      VALUES (candidate, yy);
      RETURN candidate;
    EXCEPTION
      WHEN unique_violation THEN
        NULL;
    END;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.allocate_edudeca_referral_code() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.allocate_edudeca_referral_code() TO service_role;

CREATE OR REPLACE FUNCTION public.ensure_my_edudeca_referral_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  existing text;
  minted text;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT edudeca_referral_code INTO existing
  FROM public.profiles
  WHERE id = uid
  FOR UPDATE;

  IF existing IS NOT NULL AND btrim(existing) <> '' THEN
    RETURN existing;
  END IF;

  minted := public.allocate_edudeca_referral_code();

  UPDATE public.profiles
  SET edudeca_referral_code = minted
  WHERE id = uid;

  UPDATE public.edudeca_referral_codes_issued
  SET profile_id = uid
  WHERE referral_code = minted;

  RETURN minted;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_my_edudeca_referral_code() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_my_edudeca_referral_code() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.claim_edudeca_referral_attribution(p_ref_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  normalized text;
  referrer uuid;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  normalized := upper(btrim(coalesce(p_ref_code, '')));
  IF normalized !~ '^ED-[0-9]{2}([0-9][A-Z]){4}$' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_code');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.edudeca_referral_attributions WHERE referee_user_id = uid
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_attributed');
  END IF;

  SELECT id INTO referrer
  FROM public.profiles
  WHERE edudeca_referral_code = normalized
  LIMIT 1;

  IF referrer IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unknown_code');
  END IF;

  IF referrer = uid THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'self_referral');
  END IF;

  INSERT INTO public.edudeca_referral_attributions (referrer_user_id, referee_user_id, ref_code)
  VALUES (referrer, uid, normalized);

  RETURN jsonb_build_object('ok', true, 'referrer_user_id', referrer, 'ref_code', normalized);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_attributed');
END;
$$;

REVOKE ALL ON FUNCTION public.claim_edudeca_referral_attribution(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_edudeca_referral_attribution(text) TO authenticated, service_role;

COMMENT ON COLUMN public.profiles.edudeca_referral_code IS
  'EduDeca-only invite code ED-{YY}{D}{L}{D}{L}{D}{L}{D}{L}; distinct from student_code EB-…';
COMMENT ON TABLE public.edudeca_referral_attributions IS
  'One row per EduDeca referee. Claimed via claim_edudeca_referral_attribution on signup.';

CREATE OR REPLACE FUNCTION public.list_my_edudeca_referrals(p_limit int DEFAULT 100)
RETURNS TABLE (
  attribution_id uuid,
  referee_user_id uuid,
  referee_name text,
  credited_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  lim int := GREATEST(1, LEAST(COALESCE(p_limit, 100), 200));
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    a.referee_user_id,
    COALESCE(NULLIF(btrim(p.name), ''), 'Student')::text,
    a.credited_at
  FROM public.edudeca_referral_attributions a
  JOIN public.profiles p ON p.id = a.referee_user_id
  WHERE a.referrer_user_id = uid
  ORDER BY a.credited_at DESC
  LIMIT lim;
END;
$$;

REVOKE ALL ON FUNCTION public.list_my_edudeca_referrals(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_my_edudeca_referrals(int) TO authenticated, service_role;
