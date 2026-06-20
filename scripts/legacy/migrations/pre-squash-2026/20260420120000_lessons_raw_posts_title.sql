-- Raw feed posts: headline (title) + optional body (content), for composer parity with Gyan++ ask flow.

ALTER TABLE public.lessons_raw_posts
  ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT '';

-- Backfill title from existing content (first line or flattened prefix) so new CHECK passes.
UPDATE public.lessons_raw_posts
SET title = left(
  trim(both from regexp_replace(regexp_replace(coalesce(content, ''), E'[\\n\\r]+', ' ', 'g'), E'\\s+', ' ', 'g')),
  200
)
WHERE char_length(trim(title)) < 3;

ALTER TABLE public.lessons_raw_posts
  DROP CONSTRAINT IF EXISTS lessons_raw_posts_content_len;

ALTER TABLE public.lessons_raw_posts
  ADD CONSTRAINT lessons_raw_posts_title_body_len CHECK (
    char_length(trim(title)) >= 3
    AND char_length(trim(coalesce(content, ''))) <= 2000
  );

COMMENT ON COLUMN public.lessons_raw_posts.title IS 'Short headline; body lives in content';
