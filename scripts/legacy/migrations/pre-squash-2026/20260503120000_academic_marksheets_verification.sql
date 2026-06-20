-- Academic record marksheets + admin verification workflow (matches achievements pattern).

ALTER TABLE public.profile_academics
  ADD COLUMN IF NOT EXISTS marksheet_path text;

COMMENT ON COLUMN public.profile_academics.marksheet_path IS 'Private storage path in academic-marksheets bucket.';

-- New submissions default to pending; grandfather existing rows so public profiles stay stable
ALTER TABLE public.profile_academics
  ALTER COLUMN verified SET DEFAULT 'pending';

UPDATE public.profile_academics SET verified = 'verified' WHERE true;

CREATE OR REPLACE FUNCTION public.profile_academics_enforce_verified()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_role text;
BEGIN
  jwt_role := nullif(trim(coalesce(
    current_setting('request.jwt.claim.role', true),
    ''
  )), '');

  IF coalesce(NEW.verified, '') <> 'verified' THEN
    RETURN NEW;
  END IF;

  IF jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND coalesce(OLD.verified, '') = 'verified' AND NEW.verified = 'verified' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Only administrators can mark academic records as verified'
    USING ERRCODE = 'check_violation';
END;
$$;

DROP TRIGGER IF EXISTS trg_profile_academics_enforce_verified ON public.profile_academics;
CREATE TRIGGER trg_profile_academics_enforce_verified
  BEFORE INSERT OR UPDATE ON public.profile_academics
  FOR EACH ROW
  EXECUTE FUNCTION public.profile_academics_enforce_verified();

INSERT INTO storage.buckets (id, name, public)
VALUES ('academic-marksheets', 'academic-marksheets', false)
ON CONFLICT (id) DO UPDATE
SET public = excluded.public;

UPDATE storage.buckets
SET
  file_size_limit = 10485760,
  allowed_mime_types = array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf'
  ]::text[]
WHERE id = 'academic-marksheets';

DROP POLICY IF EXISTS "academic_ms_select_own" ON storage.objects;
DROP POLICY IF EXISTS "academic_ms_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "academic_ms_update_own" ON storage.objects;
DROP POLICY IF EXISTS "academic_ms_delete_own" ON storage.objects;

CREATE POLICY "academic_ms_select_own"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'academic-marksheets'
  AND owner = auth.uid()
);

CREATE POLICY "academic_ms_insert_own"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'academic-marksheets'
  AND owner = auth.uid()
  AND public.is_owner_prefixed_storage_path(name)
);

CREATE POLICY "academic_ms_update_own"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'academic-marksheets'
  AND owner = auth.uid()
)
WITH CHECK (
  bucket_id = 'academic-marksheets'
  AND owner = auth.uid()
  AND public.is_owner_prefixed_storage_path(name)
);

CREATE POLICY "academic_ms_delete_own"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'academic-marksheets'
  AND owner = auth.uid()
);
