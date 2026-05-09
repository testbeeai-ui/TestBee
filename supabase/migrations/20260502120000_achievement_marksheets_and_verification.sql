-- Student achievement marksheets (private storage) + verification + new fields.
-- Existing rows default to verified; new rows default to pending (see column default change below).

-- 1) Table columns
ALTER TABLE public.profile_achievements
  ADD COLUMN IF NOT EXISTS percentage text NOT NULL DEFAULT '';

ALTER TABLE public.profile_achievements
  ADD COLUMN IF NOT EXISTS marksheet_path text;

-- Default 'verified' applies to existing rows at add time; then future inserts use 'pending'
ALTER TABLE public.profile_achievements
  ADD COLUMN IF NOT EXISTS verified text NOT NULL DEFAULT 'verified'
  CHECK (verified IN ('verified', 'pending', 'unverified'));

ALTER TABLE public.profile_achievements
  ALTER COLUMN verified SET DEFAULT 'pending';

-- 2) Enforce: only service_role (or keeping an already-verified row) can set verified = 'verified' for end users
CREATE OR REPLACE FUNCTION public.profile_achievements_enforce_verified()
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

  RAISE EXCEPTION 'Only administrators can mark achievements as verified'
    USING ERRCODE = 'check_violation';
END;
$$;

DROP TRIGGER IF EXISTS trg_profile_achievements_enforce_verified ON public.profile_achievements;
CREATE TRIGGER trg_profile_achievements_enforce_verified
  BEFORE INSERT OR UPDATE ON public.profile_achievements
  FOR EACH ROW
  EXECUTE FUNCTION public.profile_achievements_enforce_verified();

COMMENT ON COLUMN public.profile_achievements.percentage IS 'Score or percentage text shown on profile when verified.';
COMMENT ON COLUMN public.profile_achievements.marksheet_path IS 'Private storage object path in achievement-marksheets bucket.';
COMMENT ON COLUMN public.profile_achievements.verified IS 'verified | pending | unverified; only admins set verified.';

-- 3) Storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('achievement-marksheets', 'achievement-marksheets', false)
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
WHERE id = 'achievement-marksheets';

DROP POLICY IF EXISTS "achievement_ms_select_own" ON storage.objects;
DROP POLICY IF EXISTS "achievement_ms_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "achievement_ms_update_own" ON storage.objects;
DROP POLICY IF EXISTS "achievement_ms_delete_own" ON storage.objects;

CREATE POLICY "achievement_ms_select_own"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'achievement-marksheets'
  AND owner = auth.uid()
);

CREATE POLICY "achievement_ms_insert_own"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'achievement-marksheets'
  AND owner = auth.uid()
  AND public.is_owner_prefixed_storage_path(name)
);

CREATE POLICY "achievement_ms_update_own"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'achievement-marksheets'
  AND owner = auth.uid()
)
WITH CHECK (
  bucket_id = 'achievement-marksheets'
  AND owner = auth.uid()
  AND public.is_owner_prefixed_storage_path(name)
);

CREATE POLICY "achievement_ms_delete_own"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'achievement-marksheets'
  AND owner = auth.uid()
);
