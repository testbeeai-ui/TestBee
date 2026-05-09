-- Per-user bookmarks for catalog mock / past-paper / quick-mock (static) questions.
CREATE TABLE IF NOT EXISTS public.saved_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  question_id text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('mock', 'past_paper', 'static')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, question_id, source_type)
);

CREATE INDEX IF NOT EXISTS idx_saved_questions_user_id ON public.saved_questions (user_id);
CREATE INDEX IF NOT EXISTS idx_saved_questions_user_created ON public.saved_questions (user_id, created_at DESC);

COMMENT ON TABLE public.saved_questions IS 'Student bookmarks for mock/past-paper/static practice questions; one row per user+question+source.';

ALTER TABLE public.saved_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own saved questions" ON public.saved_questions;
CREATE POLICY "Users manage own saved questions"
  ON public.saved_questions
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
