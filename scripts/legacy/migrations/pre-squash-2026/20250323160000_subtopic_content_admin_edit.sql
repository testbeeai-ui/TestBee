-- Global editable theory content per subtopic/level.
CREATE TABLE IF NOT EXISTS public.subtopic_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board text NOT NULL,
  subject text NOT NULL,
  class_level integer NOT NULL,
  topic text NOT NULL,
  subtopic_name text NOT NULL,
  level text NOT NULL,
  theory text NOT NULL DEFAULT '',
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subtopic_content_unique_key
    UNIQUE (board, subject, class_level, topic, subtopic_name, level)
);

ALTER TABLE public.subtopic_content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subtopic_content_select_authenticated" ON public.subtopic_content;
CREATE POLICY "subtopic_content_select_authenticated"
  ON public.subtopic_content
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "subtopic_content_insert_admin" ON public.subtopic_content;
CREATE POLICY "subtopic_content_insert_admin"
  ON public.subtopic_content
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

DROP POLICY IF EXISTS "subtopic_content_update_admin" ON public.subtopic_content;
CREATE POLICY "subtopic_content_update_admin"
  ON public.subtopic_content
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

COMMENT ON TABLE public.subtopic_content IS 'Global editable subtopic theory content (admin-managed).';
COMMENT ON COLUMN public.subtopic_content.theory IS 'Rendered markdown for topic page left-panel theory.';
