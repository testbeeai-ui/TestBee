-- User-saved Lessons community posts for Revision > Community Posts tab.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS saved_community_posts jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.profiles.saved_community_posts IS 'User-saved lessons community posts shown in Revision > Community Posts.';
