-- Separate Past Papers (PYQ) from Mock Papers.
-- Moves current PYQ rows out of mock_* tables into dedicated past_* tables.

CREATE TABLE IF NOT EXISTS public.past_papers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  exam_name text,
  exam_set_name text,
  paper_type text NOT NULL DEFAULT 'pyq' CHECK (paper_type = 'pyq'),
  duration_minutes integer NOT NULL DEFAULT 180,
  total_marks integer NOT NULL DEFAULT 360,
  question_count integer NOT NULL DEFAULT 0,
  marking_scheme text NOT NULL DEFAULT '+4 for each correct response, -1 for each incorrect response, 0 if unattempted.',
  class_level smallint NOT NULL DEFAULT 12 CHECK (class_level IN (11, 12)),
  tags text[] NOT NULL DEFAULT '{}'::text[],
  subjects_covered text[] NOT NULL DEFAULT '{}'::text[],
  published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT past_papers_subjects_check CHECK (
    subjects_covered <@ ARRAY['physics', 'chemistry', 'math', 'biology']::text[]
  )
);

CREATE TABLE IF NOT EXISTS public.past_paper_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id uuid NOT NULL REFERENCES public.past_papers(id) ON DELETE CASCADE,
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
  CONSTRAINT past_paper_questions_paper_sort UNIQUE (paper_id, sort_order)
);

CREATE INDEX IF NOT EXISTS idx_past_paper_questions_paper_sort
  ON public.past_paper_questions (paper_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_past_papers_published
  ON public.past_papers (published) WHERE published = true;

ALTER TABLE public.past_papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.past_paper_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read past_papers" ON public.past_papers;
CREATE POLICY "Authenticated read past_papers"
  ON public.past_papers
  FOR SELECT
  TO authenticated
  USING (published = true);

DROP POLICY IF EXISTS "Authenticated read past_paper_questions" ON public.past_paper_questions;
CREATE POLICY "Authenticated read past_paper_questions"
  ON public.past_paper_questions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.past_papers p
      WHERE p.id = past_paper_questions.paper_id
        AND p.published = true
    )
  );

-- Backfill existing PYQ catalog/questions into new past_* tables.
INSERT INTO public.past_papers (
  id,
  slug,
  title,
  exam_name,
  exam_set_name,
  paper_type,
  duration_minutes,
  total_marks,
  question_count,
  marking_scheme,
  class_level,
  tags,
  subjects_covered,
  published,
  created_at
)
SELECT
  mp.id,
  mp.slug,
  mp.title,
  mp.exam_name,
  mp.exam_set_name,
  'pyq',
  mp.duration_minutes,
  mp.total_marks,
  mp.question_count,
  mp.marking_scheme,
  mp.class_level,
  mp.tags,
  mp.subjects_covered,
  mp.published,
  mp.created_at
FROM public.mock_papers mp
WHERE mp.paper_type = 'pyq'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.past_paper_questions (
  id,
  paper_id,
  sort_order,
  source_question_id,
  subject,
  topic,
  chapter,
  difficulty,
  question_html,
  solution_html,
  correct_letter,
  options_json
)
SELECT
  mq.id,
  mq.paper_id,
  mq.sort_order,
  mq.source_question_id,
  mq.subject,
  mq.topic,
  mq.chapter,
  mq.difficulty,
  mq.question_html,
  mq.solution_html,
  mq.correct_letter,
  mq.options_json
FROM public.mock_questions mq
JOIN public.mock_papers mp ON mp.id = mq.paper_id
WHERE mp.paper_type = 'pyq'
ON CONFLICT (id) DO NOTHING;

-- Remove PYQ rows from mock_* tables so mock tables only contain mock content.
DELETE FROM public.mock_questions mq
USING public.mock_papers mp
WHERE mq.paper_id = mp.id
  AND mp.paper_type = 'pyq';

DELETE FROM public.mock_papers
WHERE paper_type = 'pyq';

-- Keep mock table constrained to mock library categories only.
ALTER TABLE public.mock_papers
  DROP CONSTRAINT IF EXISTS mock_papers_paper_type_check;

ALTER TABLE public.mock_papers
  ADD CONSTRAINT mock_papers_paper_type_check
  CHECK (paper_type IN ('ncert', 'chapter', 'full', 'mock'));

COMMENT ON TABLE public.past_papers IS 'Past papers catalog (PYQ only).';
COMMENT ON TABLE public.past_paper_questions IS 'Per-question rows for past_papers.';
