-- Repair: achievement marksheets columns + trigger + bucket if missing (idempotent).
-- Safe to run multiple times.

ALTER TABLE public.profile_achievements
  ADD COLUMN IF NOT EXISTS percentage text NOT NULL DEFAULT '';

ALTER TABLE public.profile_achievements
  ADD COLUMN IF NOT EXISTS marksheet_path text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profile_achievements'
      AND column_name = 'verified'
  ) THEN
    ALTER TABLE public.profile_achievements
      ADD COLUMN verified text NOT NULL DEFAULT 'verified';

    ALTER TABLE public.profile_achievements
      ADD CONSTRAINT profile_achievements_verified_check
      CHECK (verified IN ('verified', 'pending', 'unverified'));

    ALTER TABLE public.profile_achievements
      ALTER COLUMN verified SET DEFAULT 'pending';

    UPDATE public.profile_achievements SET verified = 'verified';
  END IF;
END $$;

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
