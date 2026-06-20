ALTER TABLE public.topic_content
  ADD COLUMN IF NOT EXISTS subtopic_previews jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.topic_content.subtopic_previews IS
  'Agent-generated array of { subtopicName: string, preview: string }.';
