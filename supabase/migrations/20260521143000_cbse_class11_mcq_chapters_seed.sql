-- Seed CBSE Class 11 NCERT chapter catalog (45 chapters). Keep in sync with MCQ_CHAPTERS[11] in constants.ts.

INSERT INTO public.cbse_mcq_chapters (chapter_id, board, class_level, subject, chapter_name, sort_order)
VALUES
  ('p11-1', 'CBSE', 11, 'physics', 'Physical World', 1),
  ('p11-2', 'CBSE', 11, 'physics', 'Units and Measurements', 2),
  ('p11-3', 'CBSE', 11, 'physics', 'Motion in a Straight Line', 3),
  ('p11-4', 'CBSE', 11, 'physics', 'Motion in a Plane', 4),
  ('p11-5', 'CBSE', 11, 'physics', 'Laws of Motion', 5),
  ('p11-6', 'CBSE', 11, 'physics', 'Work, Energy and Power', 6),
  ('p11-7', 'CBSE', 11, 'physics', 'System of Particles and Rotational Motion', 7),
  ('p11-8', 'CBSE', 11, 'physics', 'Gravitation', 8),
  ('p11-9', 'CBSE', 11, 'physics', 'Mechanical Properties of Solids', 9),
  ('p11-10', 'CBSE', 11, 'physics', 'Mechanical Properties of Fluids', 10),
  ('p11-11', 'CBSE', 11, 'physics', 'Thermal Properties of Matter', 11),
  ('p11-12', 'CBSE', 11, 'physics', 'Thermodynamics', 12),
  ('p11-13', 'CBSE', 11, 'physics', 'Kinetic Theory', 13),
  ('p11-14', 'CBSE', 11, 'physics', 'Oscillations', 14),
  ('p11-15', 'CBSE', 11, 'physics', 'Waves', 15),
  ('c11-1', 'CBSE', 11, 'chemistry', 'Some Basic Concepts of Chemistry', 1),
  ('c11-2', 'CBSE', 11, 'chemistry', 'Structure of Atom', 2),
  ('c11-3', 'CBSE', 11, 'chemistry', 'Classification of Elements and Periodicity', 3),
  ('c11-4', 'CBSE', 11, 'chemistry', 'Chemical Bonding and Molecular Structure', 4),
  ('c11-5', 'CBSE', 11, 'chemistry', 'States of Matter', 5),
  ('c11-6', 'CBSE', 11, 'chemistry', 'Thermodynamics', 6),
  ('c11-7', 'CBSE', 11, 'chemistry', 'Equilibrium', 7),
  ('c11-8', 'CBSE', 11, 'chemistry', 'Redox Reactions', 8),
  ('c11-9', 'CBSE', 11, 'chemistry', 'Hydrogen', 9),
  ('c11-10', 'CBSE', 11, 'chemistry', 'The s-Block Elements', 10),
  ('c11-11', 'CBSE', 11, 'chemistry', 'The p-Block Elements', 11),
  ('c11-12', 'CBSE', 11, 'chemistry', 'Organic Chemistry – Basic Principles', 12),
  ('c11-13', 'CBSE', 11, 'chemistry', 'Hydrocarbons', 13),
  ('c11-14', 'CBSE', 11, 'chemistry', 'Environmental Chemistry', 14),
  ('m11-1', 'CBSE', 11, 'math', 'Sets', 1),
  ('m11-2', 'CBSE', 11, 'math', 'Relations and Functions', 2),
  ('m11-3', 'CBSE', 11, 'math', 'Trigonometric Functions', 3),
  ('m11-4', 'CBSE', 11, 'math', 'Principle of Mathematical Induction', 4),
  ('m11-5', 'CBSE', 11, 'math', 'Complex Numbers and Quadratic Equations', 5),
  ('m11-6', 'CBSE', 11, 'math', 'Linear Inequalities', 6),
  ('m11-7', 'CBSE', 11, 'math', 'Permutations and Combinations', 7),
  ('m11-8', 'CBSE', 11, 'math', 'Binomial Theorem', 8),
  ('m11-9', 'CBSE', 11, 'math', 'Sequences and Series', 9),
  ('m11-10', 'CBSE', 11, 'math', 'Straight Lines', 10),
  ('m11-11', 'CBSE', 11, 'math', 'Conic Sections', 11),
  ('m11-12', 'CBSE', 11, 'math', 'Introduction to 3D Geometry', 12),
  ('m11-13', 'CBSE', 11, 'math', 'Limits and Derivatives', 13),
  ('m11-14', 'CBSE', 11, 'math', 'Mathematical Reasoning', 14),
  ('m11-15', 'CBSE', 11, 'math', 'Statistics', 15),
  ('m11-16', 'CBSE', 11, 'math', 'Probability', 16)
ON CONFLICT (chapter_id) DO UPDATE SET
  chapter_name = EXCLUDED.chapter_name,
  subject = EXCLUDED.subject,
  sort_order = EXCLUDED.sort_order,
  class_level = EXCLUDED.class_level;

-- Class 11 chapter papers (same pattern as class 12)
CREATE UNIQUE INDEX IF NOT EXISTS idx_mock_papers_cbse11_chapter_id
  ON public.mock_papers (chapter_id)
  WHERE paper_type = 'chapter'
    AND board = 'CBSE'
    AND class_level = 11
    AND chapter_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mock_papers_cbse11_chapter_list
  ON public.mock_papers (board, class_level, paper_type, published)
  WHERE board = 'CBSE' AND class_level = 11 AND paper_type = 'chapter';
