-- Audit trail for topic hub AI runs (generate / regenerate with feedback).
CREATE TABLE IF NOT EXISTS public.topic_content_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board text NOT NULL,
  subject text NOT NULL,
  class_level integer NOT NULL,
  topic text NOT NULL,
  level text NOT NULL,
  run_type text NOT NULL CHECK (run_type IN ('generate', 'regenerate')),
  feedback_text text NOT NULL DEFAULT '',
  liked_points text NOT NULL DEFAULT '',
  disliked_points text NOT NULL DEFAULT '',
  instructions text NOT NULL DEFAULT '',
  previous_content jsonb NOT NULL DEFAULT '{}'::jsonb,
  rag_chunk_count integer NOT NULL DEFAULT 0,
  model_id text NOT NULL DEFAULT '',
  output_content jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS topic_content_runs_lookup_idx
  ON public.topic_content_runs (board, subject, class_level, topic, level, created_at DESC);

ALTER TABLE public.topic_content_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "topic_content_runs_select_authenticated" ON public.topic_content_runs;
CREATE POLICY "topic_content_runs_select_authenticated"
  ON public.topic_content_runs
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "topic_content_runs_insert_admin" ON public.topic_content_runs;
CREATE POLICY "topic_content_runs_insert_admin"
  ON public.topic_content_runs
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

COMMENT ON TABLE public.topic_content_runs IS 'History of topic_content AI generations and regenerations with optional user feedback.';
