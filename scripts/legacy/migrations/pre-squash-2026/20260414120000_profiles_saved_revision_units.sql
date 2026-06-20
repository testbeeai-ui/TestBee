-- User-saved revision units from Deep Dive (for Unit Revision tab).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS saved_revision_units jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.profiles.saved_revision_units IS 'User-saved Deep Dive revision units shown in Revision > Unit Revision.';
