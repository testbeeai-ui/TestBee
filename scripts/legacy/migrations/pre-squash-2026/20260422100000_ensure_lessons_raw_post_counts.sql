-- Ensure denormalized counts exist on lessons_raw_posts (fixes "column upvote_count does not exist"
-- when the app points at a project that missed the earlier migration or used a partial apply).

ALTER TABLE public.lessons_raw_posts
  ADD COLUMN IF NOT EXISTS upvote_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS downvote_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comment_count integer NOT NULL DEFAULT 0;
