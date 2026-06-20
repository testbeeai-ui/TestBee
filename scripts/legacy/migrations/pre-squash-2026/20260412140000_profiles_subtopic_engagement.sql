ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subtopic_engagement jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.profiles.subtopic_engagement IS
  'Per-subtopic-level learning progress: quiz drafts, formula numerals drafts, InstaCue navigation/flip coverage, concepts pages visited. Keyed like bits_test_attempts.';
