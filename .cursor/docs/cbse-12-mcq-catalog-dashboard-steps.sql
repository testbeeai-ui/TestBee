-- Run in Supabase SQL Editor ONE block at a time (not all at once).
-- Project: bytsiknhtcnlxwzgqkrd
-- If a step times out, wait 2–5 min and retry that step only.

-- ========== STEP 0: test connection (run alone) ==========
SELECT 1 AS ok;

-- ========== STEP 1: catalog table + seed (fast) ==========
CREATE TABLE IF NOT EXISTS public.cbse_mcq_chapters (
  chapter_id text PRIMARY KEY,
  board text NOT NULL DEFAULT 'CBSE' CHECK (board IN ('CBSE', 'ICSE')),
  class_level smallint NOT NULL DEFAULT 12 CHECK (class_level IN (11, 12)),
  subject text NOT NULL CHECK (subject IN ('physics', 'chemistry', 'math')),
  chapter_name text NOT NULL,
  sort_order smallint NOT NULL CHECK (sort_order > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cbse_mcq_chapters_class_subject_sort UNIQUE (board, class_level, subject, sort_order)
);

CREATE INDEX IF NOT EXISTS idx_cbse_mcq_chapters_list
  ON public.cbse_mcq_chapters (board, class_level, subject, sort_order);

INSERT INTO public.cbse_mcq_chapters (chapter_id, board, class_level, subject, chapter_name, sort_order)
VALUES
  ('p12-1', 'CBSE', 12, 'physics', 'Electric Charges and Fields', 1),
  ('p12-2', 'CBSE', 12, 'physics', 'Electrostatic Potential and Capacitance', 2),
  ('p12-3', 'CBSE', 12, 'physics', 'Current Electricity', 3),
  ('p12-4', 'CBSE', 12, 'physics', 'Moving Charges and Magnetism', 4),
  ('p12-5', 'CBSE', 12, 'physics', 'Magnetism and Matter', 5),
  ('p12-6', 'CBSE', 12, 'physics', 'Electromagnetic Induction', 6),
  ('p12-7', 'CBSE', 12, 'physics', 'Alternating Current', 7),
  ('p12-8', 'CBSE', 12, 'physics', 'Electromagnetic Waves', 8),
  ('p12-9', 'CBSE', 12, 'physics', 'Ray Optics and Optical Instruments', 9),
  ('p12-10', 'CBSE', 12, 'physics', 'Wave Optics', 10),
  ('p12-11', 'CBSE', 12, 'physics', 'Dual Nature of Radiation and Matter', 11),
  ('p12-12', 'CBSE', 12, 'physics', 'Atoms', 12),
  ('p12-13', 'CBSE', 12, 'physics', 'Nuclei', 13),
  ('p12-14', 'CBSE', 12, 'physics', 'Semiconductor Electronics: Materials, Devices and Simple Circuits', 14),
  ('p12-15', 'CBSE', 12, 'physics', 'Communication Systems', 15),
  ('c12-1', 'CBSE', 12, 'chemistry', 'The Solid State', 1),
  ('c12-2', 'CBSE', 12, 'chemistry', 'Solutions', 2),
  ('c12-3', 'CBSE', 12, 'chemistry', 'Electrochemistry', 3),
  ('c12-4', 'CBSE', 12, 'chemistry', 'Chemical Kinetics', 4),
  ('c12-5', 'CBSE', 12, 'chemistry', 'Surface Chemistry', 5),
  ('c12-6', 'CBSE', 12, 'chemistry', 'General Principles of Isolation of Elements', 6),
  ('c12-7', 'CBSE', 12, 'chemistry', 'The p-Block Elements', 7),
  ('c12-8', 'CBSE', 12, 'chemistry', 'The d- and f-Block Elements', 8),
  ('c12-9', 'CBSE', 12, 'chemistry', 'Coordination Compounds', 9),
  ('c12-10', 'CBSE', 12, 'chemistry', 'Haloalkanes and Haloarenes', 10),
  ('c12-11', 'CBSE', 12, 'chemistry', 'Alcohols, Phenols and Ethers', 11),
  ('c12-12', 'CBSE', 12, 'chemistry', 'Aldehydes, Ketones and Carboxylic Acids', 12),
  ('c12-13', 'CBSE', 12, 'chemistry', 'Amines', 13),
  ('c12-14', 'CBSE', 12, 'chemistry', 'Biomolecules', 14),
  ('c12-15', 'CBSE', 12, 'chemistry', 'Polymers', 15),
  ('c12-16', 'CBSE', 12, 'chemistry', 'Chemistry in Everyday Life', 16),
  ('m12-1', 'CBSE', 12, 'math', 'Relations and Functions', 1),
  ('m12-2', 'CBSE', 12, 'math', 'Inverse Trigonometric Functions', 2),
  ('m12-3', 'CBSE', 12, 'math', 'Matrices', 3),
  ('m12-4', 'CBSE', 12, 'math', 'Determinants', 4),
  ('m12-5', 'CBSE', 12, 'math', 'Continuity and Differentiability', 5),
  ('m12-6', 'CBSE', 12, 'math', 'Application of Derivatives', 6),
  ('m12-7', 'CBSE', 12, 'math', 'Integrals', 7),
  ('m12-8', 'CBSE', 12, 'math', 'Application of Integrals', 8),
  ('m12-9', 'CBSE', 12, 'math', 'Differential Equations', 9),
  ('m12-10', 'CBSE', 12, 'math', 'Vector Algebra', 10),
  ('m12-11', 'CBSE', 12, 'math', 'Three Dimensional Geometry', 11),
  ('m12-12', 'CBSE', 12, 'math', 'Linear Programming', 12),
  ('m12-13', 'CBSE', 12, 'math', 'Probability', 13)
ON CONFLICT (chapter_id) DO UPDATE SET
  chapter_name = EXCLUDED.chapter_name,
  subject = EXCLUDED.subject,
  sort_order = EXCLUDED.sort_order;

-- ========== STEP 2: mock_papers columns + FK ==========
ALTER TABLE public.mock_papers
  ADD COLUMN IF NOT EXISTS board text,
  ADD COLUMN IF NOT EXISTS chapter_id text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'mock_papers_chapter_id_fkey'
  ) THEN
    ALTER TABLE public.mock_papers
      ADD CONSTRAINT mock_papers_chapter_id_fkey
      FOREIGN KEY (chapter_id)
      REFERENCES public.cbse_mcq_chapters (chapter_id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- ========== STEP 3: indexes on mock_papers (usually fast) ==========
CREATE UNIQUE INDEX IF NOT EXISTS idx_mock_papers_cbse12_chapter_id
  ON public.mock_papers (chapter_id)
  WHERE paper_type = 'chapter'
    AND board = 'CBSE'
    AND class_level = 12
    AND chapter_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mock_papers_cbse12_chapter_list
  ON public.mock_papers (board, class_level, paper_type, published)
  WHERE board = 'CBSE' AND class_level = 12 AND paper_type = 'chapter';

-- ========== STEP 4: RLS ==========
ALTER TABLE public.cbse_mcq_chapters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read cbse_mcq_chapters" ON public.cbse_mcq_chapters;
CREATE POLICY "Authenticated read cbse_mcq_chapters"
  ON public.cbse_mcq_chapters
  FOR SELECT TO authenticated
  USING (true);

-- ========== STEP 5 (OPTIONAL — can be slow if mock_questions is huge) ==========
-- Skip if Step 0–4 succeeded and you need to import soon; add later.
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_mock_questions_paper_source_id
--   ON public.mock_questions (paper_id, source_question_id)
--   WHERE source_question_id IS NOT NULL;

-- ========== VERIFY ==========
SELECT COUNT(*) AS chapter_count FROM public.cbse_mcq_chapters;
