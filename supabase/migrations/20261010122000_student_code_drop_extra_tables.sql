-- Keep uniqueness only on profiles.student_code (unique index).
-- Drop unused helper tables from sequential/claim experiments.
-- Random allocate uses a transaction advisory lock + EXISTS check (no extra table).

DROP TABLE IF EXISTS public.student_id_issued CASCADE;
DROP TABLE IF EXISTS public.student_id_year_counters CASCADE;
DROP FUNCTION IF EXISTS public.encode_student_code_suffix(bigint);

CREATE OR REPLACE FUNCTION public.allocate_student_code()
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
  PERFORM pg_advisory_xact_lock(hashtext('public.allocate_student_code'));

  yy := EXTRACT(YEAR FROM (now() AT TIME ZONE 'Asia/Kolkata'))::int % 100;

  LOOP
    attempt := attempt + 1;
    IF attempt > 64 THEN
      RAISE EXCEPTION 'could not allocate a unique random student code after % attempts', attempt;
    END IF;

    suffix :=
      substr(letters, 1 + floor(random() * 26)::int, 1) ||
      (floor(random() * 10)::int)::text ||
      substr(letters, 1 + floor(random() * 26)::int, 1) ||
      (floor(random() * 10)::int)::text ||
      substr(letters, 1 + floor(random() * 26)::int, 1) ||
      (floor(random() * 10)::int)::text;

    candidate := 'EB-' || lpad(yy::text, 2, '0') || suffix;

    IF NOT EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE student_code = candidate
    ) THEN
      RETURN candidate;
    END IF;
  END LOOP;
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
  ELSIF EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.student_code = NEW.student_code
      AND p.id IS DISTINCT FROM NEW.id
  ) THEN
    NEW.student_code := public.allocate_student_code();
  END IF;
  RETURN NEW;
END;
$$;

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

CREATE UNIQUE INDEX IF NOT EXISTS profiles_student_code_uidx
  ON public.profiles (student_code);

COMMENT ON COLUMN public.profiles.student_code IS
  'Public Student ID: EB-YY + random L/D/L/D/L/D. Unique on profiles; no helper tables.';
