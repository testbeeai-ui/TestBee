-- Store saved Bits and Formulas in profiles for reliable persistence across sessions/devices.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS saved_bits jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS saved_formulas jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.profiles.saved_bits IS 'User saved Bits (MCQ questions) from Deep Dive, persisted for revision.';
COMMENT ON COLUMN public.profiles.saved_formulas IS 'User saved formula practice sets from Deep Dive, persisted for revision.';
