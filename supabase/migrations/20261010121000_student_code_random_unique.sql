-- Random Student IDs (still EB-{YY}{L}{D}{L}{D}{L}{D}), uniqueness via claim table.
-- Not sequential — not guessable from neighboring accounts.

CREATE TABLE IF NOT EXISTS public.student_id_issued (
  student_code text PRIMARY KEY,
  year_yy smallint NOT NULL,
  profile_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.student_id_issued ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.student_id_issued FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.student_id_issued TO service_role;

CREATE INDEX IF NOT EXISTS student_id_issued_year_yy_idx
  ON public.student_id_issued (year_yy);

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

    BEGIN
      INSERT INTO public.student_id_issued (student_code, year_yy)
      VALUES (candidate, yy);
      RETURN candidate;
    EXCEPTION
      WHEN unique_violation THEN
        NULL;
    END;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.allocate_student_code() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.allocate_student_code() TO service_role;

ALTER TABLE public.profiles ALTER COLUMN student_code DROP NOT NULL;

TRUNCATE public.student_id_issued;

UPDATE public.profiles SET student_code = NULL;

DO $$
DECLARE
  r record;
  minted text;
BEGIN
  FOR r IN
    SELECT id FROM public.profiles ORDER BY created_at NULLS LAST, id
  LOOP
    minted := public.allocate_student_code();
    UPDATE public.profiles
    SET student_code = minted
    WHERE id = r.id;

    UPDATE public.student_id_issued
    SET profile_id = r.id
    WHERE student_code = minted;
  END LOOP;
END;
$$;

ALTER TABLE public.profiles ALTER COLUMN student_code SET NOT NULL;

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

  UPDATE public.student_id_issued
  SET profile_id = uid
  WHERE student_code = minted;

  SELECT student_code INTO existing FROM public.profiles WHERE id = uid;
  RETURN existing;
END;
$$;

CREATE OR REPLACE FUNCTION public.profiles_assign_student_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.student_code IS NULL OR btrim(NEW.student_code) = '' THEN
    NEW.student_code := public.allocate_student_code();
  ELSE
    BEGIN
      INSERT INTO public.student_id_issued (
        student_code,
        year_yy,
        profile_id
      ) VALUES (
        NEW.student_code,
        NULLIF(substring(NEW.student_code from 4 for 2), '')::smallint,
        NEW.id
      )
      ON CONFLICT (student_code) DO UPDATE
        SET profile_id = COALESCE(public.student_id_issued.profile_id, EXCLUDED.profile_id);
    EXCEPTION
      WHEN others THEN
        NEW.student_code := public.allocate_student_code();
    END;
  END IF;

  UPDATE public.student_id_issued
  SET profile_id = NEW.id
  WHERE student_code = NEW.student_code
    AND (profile_id IS NULL OR profile_id = NEW.id);

  RETURN NEW;
END;
$$;

COMMENT ON COLUMN public.profiles.student_code IS
  'Public Student ID: EB-YY + random alternating letter/digit (LDLDLD). Unique; not sequential.';
