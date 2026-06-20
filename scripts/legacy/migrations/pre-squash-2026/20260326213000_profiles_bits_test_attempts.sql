ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bits_test_attempts jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.profiles.bits_test_attempts IS
  'Per-user Bits test attempts keyed by board|subject|class|topic|subtopic|level for score recall and retake flow.';
