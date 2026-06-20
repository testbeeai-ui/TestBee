-- Video/reading links and optional "did you know" for subtopic-level content (admin-managed).
ALTER TABLE public.subtopic_content
  ADD COLUMN IF NOT EXISTS reading_references jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS did_you_know text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.subtopic_content.reading_references IS 'JSON array of {type,title,url,description?} for video and reading links.';
COMMENT ON COLUMN public.subtopic_content.did_you_know IS 'Optional short fact shown in Did you know dialog.';
