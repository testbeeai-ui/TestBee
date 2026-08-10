-- Public Student ID: EB-{YY}{L}{D}{L}{D}{L}{D} e.g. EB-26A0B0C1
-- Capacity per year: 26^3 * 10^3 = 17,576,000 (no duplicates).
-- Year uses Asia/Kolkata so the cohort rolls at IST New Year.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS student_code text;

COMMENT ON COLUMN public.profiles.student_code IS
  'Public Student ID: EB-YY + alternating letter/digit (LDLDLD). Unique forever.';

CREATE TABLE IF NOT EXISTS public.student_id_year_counters (
  year_yy smallint PRIMARY KEY,
  next_seq bigint NOT NULL DEFAULT 0,
  CONSTRAINT student_id_year_counters_next_seq_nonneg CHECK (next_seq >= 0)
);

ALTER TABLE public.student_id_year_counters ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.student_id_year_counters FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.student_id_year_counters TO service_role;

CREATE OR REPLACE FUNCTION public.encode_student_code_suffix(p_seq bigint)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  n bigint := p_seq;
  parts text[] := ARRAY[]::text[];
  i int;
BEGIN
  IF n IS NULL OR n < 0 THEN
    RAISE EXCEPTION 'student code sequence must be >= 0';
  END IF;
  IF n >= 17576000 THEN
    RAISE EXCEPTION 'student code sequence exhausted for year (max 17,576,000)';
  END IF;

  FOR i IN 0..5 LOOP
    IF (i % 2) = 0 THEN
      parts := array_append(parts, (n % 10)::text);
      n := n / 10;
    ELSE
      parts := array_append(parts, chr(65 + (n % 26)::int));
      n := n / 26;
    END IF;
  END LOOP;

  RETURN parts[6] || parts[5] || parts[4] || parts[3] || parts[2] || parts[1];
END;
$$;

CREATE OR REPLACE FUNCTION public.allocate_student_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  yy smallint;
  seq bigint;
  suffix text;
BEGIN
  yy := EXTRACT(YEAR FROM (now() AT TIME ZONE 'Asia/Kolkata'))::int % 100;

  INSERT INTO public.student_id_year_counters (year_yy, next_seq)
  VALUES (yy, 1)
  ON CONFLICT (year_yy) DO UPDATE
    SET next_seq = public.student_id_year_counters.next_seq + 1
  RETURNING next_seq - 1 INTO seq;

  suffix := public.encode_student_code_suffix(seq);
  RETURN 'EB-' || lpad(yy::text, 2, '0') || suffix;
END;
$$;

REVOKE ALL ON FUNCTION public.allocate_student_code() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.allocate_student_code() TO service_role;

CREATE OR REPLACE FUNCTION public.profiles_assign_student_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.student_code IS NULL OR btrim(NEW.student_code) = '' THEN
    NEW.student_code := public.allocate_student_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_assign_student_code_trg ON public.profiles;
CREATE TRIGGER profiles_assign_student_code_trg
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_assign_student_code();

CREATE OR REPLACE FUNCTION public.ensure_my_student_code()
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

  SELECT student_code INTO existing
  FROM public.profiles
  WHERE id = uid
  FOR UPDATE;

  IF existing IS NOT NULL AND btrim(existing) <> '' THEN
    RETURN existing;
  END IF;

  minted := public.allocate_student_code();

  UPDATE public.profiles
  SET student_code = minted
  WHERE id = uid
    AND (student_code IS NULL OR btrim(student_code) = '');

  SELECT student_code INTO existing FROM public.profiles WHERE id = uid;
  RETURN existing;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_my_student_code() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_my_student_code() TO authenticated, service_role;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id
    FROM public.profiles
    WHERE student_code IS NULL OR btrim(student_code) = ''
    ORDER BY created_at NULLS LAST, id
  LOOP
    UPDATE public.profiles
    SET student_code = public.allocate_student_code()
    WHERE id = r.id
      AND (student_code IS NULL OR btrim(student_code) = '');
  END LOOP;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_student_code_uidx
  ON public.profiles (student_code);

ALTER TABLE public.profiles
  ALTER COLUMN student_code SET NOT NULL;
