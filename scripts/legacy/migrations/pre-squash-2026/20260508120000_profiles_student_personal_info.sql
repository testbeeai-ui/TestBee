-- Student profile hub: personal info + institution fields (phase 1).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS institution_name text,
  ADD COLUMN IF NOT EXISTS board text,
  ADD COLUMN IF NOT EXISTS current_class_label text;

COMMENT ON COLUMN public.profiles.phone IS '10-digit Indian mobile number without country code; UI shows +91.';
COMMENT ON COLUMN public.profiles.current_class_label IS 'Display label e.g. PUC I, PUC II, Class X; may map to class_level.';
