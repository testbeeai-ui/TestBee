-- Institute mock test catalog: papers + questions (JEE PYQ etc.), loaded via scripts.

CREATE TABLE IF NOT EXISTS public.mock_papers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  exam_name text,
  exam_set_name text,
  paper_type text NOT NULL DEFAULT 'pyq'
    CHECK (paper_type IN ('pyq', 'ncert', 'chapter', 'full')),
  duration_minutes integer NOT NULL DEFAULT 180,
  total_marks integer NOT NULL DEFAULT 360,
  question_count integer NOT NULL DEFAULT 0,
  marking_scheme text NOT NULL DEFAULT '+4 for each correct response, −1 for each incorrect response, 0 if unattempted.',
  class_level smallint NOT NULL DEFAULT 12 CHECK (class_level IN (11, 12)),
  tags text[] NOT NULL DEFAULT '{}'::text[],
  subjects_covered text[] NOT NULL DEFAULT '{}'::text[],
  published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mock_papers_subjects_check CHECK (
    subjects_covered <@ ARRAY['physics', 'chemistry', 'math', 'biology']::text[]
  )
);

CREATE TABLE IF NOT EXISTS public.mock_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id uuid NOT NULL REFERENCES public.mock_papers(id) ON DELETE CASCADE,
  sort_order integer NOT NULL,
  source_question_id text,
  subject text NOT NULL CHECK (subject IN ('physics', 'chemistry', 'math', 'biology')),
  topic text,
  chapter text,
  difficulty text,
  question_html text NOT NULL,
  solution_html text,
  correct_letter char(1) NOT NULL CHECK (correct_letter IN ('A', 'B', 'C', 'D')),
  options_json jsonb NOT NULL,
  CONSTRAINT mock_questions_paper_sort UNIQUE (paper_id, sort_order)
);

CREATE INDEX IF NOT EXISTS idx_mock_questions_paper_sort
  ON public.mock_questions (paper_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_mock_papers_published
  ON public.mock_papers (published) WHERE published = true;

ALTER TABLE public.mock_papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mock_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read mock_papers" ON public.mock_papers;
CREATE POLICY "Authenticated read mock_papers"
  ON public.mock_papers
  FOR SELECT
  TO authenticated
  USING (published = true);

DROP POLICY IF EXISTS "Authenticated read mock_questions" ON public.mock_questions;
CREATE POLICY "Authenticated read mock_questions"
  ON public.mock_questions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.mock_papers p
      WHERE p.id = mock_questions.paper_id AND p.published = true
    )
  );

COMMENT ON TABLE public.mock_papers IS 'Curated timed mock exams (PYQ, NCERT, etc.); questions in mock_questions.';
COMMENT ON TABLE public.mock_questions IS 'Per-question rows for a mock_papers row; options_json is length-4 array.';
