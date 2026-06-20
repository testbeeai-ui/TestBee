-- Admin-generated topic hub copy (chapter/topic overview): three structured sections per board/subject/class/topic/level.
CREATE TABLE IF NOT EXISTS public.topic_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board text NOT NULL,
  subject text NOT NULL,
  class_level integer NOT NULL,
  topic text NOT NULL,
  level text NOT NULL,
  why_study text NOT NULL DEFAULT '',
  what_learn text NOT NULL DEFAULT '',
  real_world text NOT NULL DEFAULT '',
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT topic_content_unique_key
    UNIQUE (board, subject, class_level, topic, level)
);

ALTER TABLE public.topic_content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "topic_content_select_authenticated" ON public.topic_content;
CREATE POLICY "topic_content_select_authenticated"
  ON public.topic_content
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "topic_content_insert_admin" ON public.topic_content;
CREATE POLICY "topic_content_insert_admin"
  ON public.topic_content
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'::public.app_role
    )
  );

DROP POLICY IF EXISTS "topic_content_update_admin" ON public.topic_content;
CREATE POLICY "topic_content_update_admin"
  ON public.topic_content
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'::public.app_role
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'::public.app_role
    )
  );

COMMENT ON TABLE public.topic_content IS 'Topic hub overview sections (admin-managed, RAG+LLM generated).';
COMMENT ON COLUMN public.topic_content.why_study IS 'Markdown: why study this topic/chapter.';
COMMENT ON COLUMN public.topic_content.what_learn IS 'Markdown: learning outcomes.';
COMMENT ON COLUMN public.topic_content.real_world IS 'Markdown: real-world importance.';
