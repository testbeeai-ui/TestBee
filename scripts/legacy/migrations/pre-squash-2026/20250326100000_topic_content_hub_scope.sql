-- Separate chapter landing hub copy from per-topic hub copy (Explore chapter view vs topic overview).
ALTER TABLE public.topic_content
  ADD COLUMN IF NOT EXISTS hub_scope text NOT NULL DEFAULT 'topic';

ALTER TABLE public.topic_content
  DROP CONSTRAINT IF EXISTS topic_content_hub_scope_check;

ALTER TABLE public.topic_content
  ADD CONSTRAINT topic_content_hub_scope_check
  CHECK (hub_scope IN ('topic', 'chapter'));

ALTER TABLE public.topic_content
  DROP CONSTRAINT IF EXISTS topic_content_unique_key;

ALTER TABLE public.topic_content
  ADD CONSTRAINT topic_content_unique_key
  UNIQUE (board, subject, class_level, topic, level, hub_scope);

ALTER TABLE public.topic_content_runs
  ADD COLUMN IF NOT EXISTS hub_scope text NOT NULL DEFAULT 'topic';

ALTER TABLE public.topic_content_runs
  DROP CONSTRAINT IF EXISTS topic_content_runs_hub_scope_check;

ALTER TABLE public.topic_content_runs
  ADD CONSTRAINT topic_content_runs_hub_scope_check
  CHECK (hub_scope IN ('topic', 'chapter'));

DROP INDEX IF EXISTS topic_content_runs_lookup_idx;

CREATE INDEX topic_content_runs_lookup_idx
  ON public.topic_content_runs (board, subject, class_level, topic, level, hub_scope, created_at DESC);

COMMENT ON COLUMN public.topic_content.hub_scope IS 'topic = one syllabus topic hub (e.g. Coulomb''s Law); chapter = whole-chapter landing in Explore (topic column holds chapter title).';
COMMENT ON COLUMN public.topic_content_runs.hub_scope IS 'Matches topic_content.hub_scope for the run.';
