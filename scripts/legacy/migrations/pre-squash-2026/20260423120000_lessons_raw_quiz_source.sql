-- Quiz-result posting metadata for Lessons raw feed posts.

ALTER TABLE public.lessons_raw_posts
  ADD COLUMN IF NOT EXISTS board_ref text,
  ADD COLUMN IF NOT EXISTS grade_ref text,
  ADD COLUMN IF NOT EXISTS unit_ref text,
  ADD COLUMN IF NOT EXISTS topic_ref text,
  ADD COLUMN IF NOT EXISTS subtopic_ref text,
  ADD COLUMN IF NOT EXISTS source_type text,
  ADD COLUMN IF NOT EXISTS source_payload jsonb;

CREATE INDEX IF NOT EXISTS idx_lessons_raw_posts_source_type
  ON public.lessons_raw_posts (source_type);

COMMENT ON COLUMN public.lessons_raw_posts.board_ref IS 'Origin board slug for contextual posts (e.g. cbse, icse)';
COMMENT ON COLUMN public.lessons_raw_posts.grade_ref IS 'Origin class/grade slug for contextual posts';
COMMENT ON COLUMN public.lessons_raw_posts.unit_ref IS 'Origin curriculum unit slug for contextual posts';
COMMENT ON COLUMN public.lessons_raw_posts.topic_ref IS 'Origin topic slug/title for contextual posts';
COMMENT ON COLUMN public.lessons_raw_posts.subtopic_ref IS 'Origin subtopic slug/title for contextual posts';
COMMENT ON COLUMN public.lessons_raw_posts.source_type IS 'Origin of post creation flow (e.g. quiz_post)';
COMMENT ON COLUMN public.lessons_raw_posts.source_payload IS 'Structured origin payload (score/accuracy/template metadata)';
