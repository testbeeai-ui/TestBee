-- Optional admin override for subtopic page heading (spacing / wording).
-- NULL = use curriculum subtopic name (client applies prettify only).

ALTER TABLE public.subtopic_content
  ADD COLUMN IF NOT EXISTS display_title text;

COMMENT ON COLUMN public.subtopic_content.display_title IS 'Optional heading shown on subtopic deep dive; NULL uses curriculum subtopic name.';
