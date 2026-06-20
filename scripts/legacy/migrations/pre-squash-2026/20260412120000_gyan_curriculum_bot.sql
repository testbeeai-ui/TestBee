-- Curriculum-driven Gyan++ bot: ordered nodes (chapter/topic/subtopic), batch slot (1–5, slot 5 = numeric), dedupe via doubts.gyan_curriculum_node_id.

CREATE TABLE IF NOT EXISTS public.gyan_curriculum_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL,
  class_level smallint NOT NULL CHECK (class_level IN (11, 12)),
  sort_order integer NOT NULL UNIQUE,
  chapter_key text NOT NULL,
  chapter_label text NOT NULL,
  topic_key text NOT NULL,
  topic_label text NOT NULL,
  subtopic_key text,
  subtopic_label text,
  rag_query_hint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gyan_curriculum_nodes_subject_sort
  ON public.gyan_curriculum_nodes (subject, sort_order);

COMMENT ON TABLE public.gyan_curriculum_nodes IS 'CBSE-aligned curriculum cells for bot doubt rotation; rag_query_hint seeds RAG retrieval.';

ALTER TABLE public.doubts
  ADD COLUMN IF NOT EXISTS gyan_curriculum_node_id uuid REFERENCES public.gyan_curriculum_nodes (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_doubts_gyan_curriculum_node_id
  ON public.doubts (gyan_curriculum_node_id)
  WHERE gyan_curriculum_node_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_doubts_bot_curriculum_dedupe
  ON public.doubts (gyan_curriculum_node_id, user_id);

COMMENT ON COLUMN public.doubts.gyan_curriculum_node_id IS 'When set by Gyan++ bot, links doubt to curriculum cell for coverage / dedupe.';

ALTER TABLE public.gyan_bot_config
  ADD COLUMN IF NOT EXISTS curriculum_sequence_index integer NOT NULL DEFAULT 0;

ALTER TABLE public.gyan_bot_config
  ADD COLUMN IF NOT EXISTS curriculum_batch_slot smallint NOT NULL DEFAULT 1
    CHECK (curriculum_batch_slot >= 1 AND curriculum_batch_slot <= 5);

COMMENT ON COLUMN public.gyan_bot_config.curriculum_sequence_index IS 'Increments each bot post; modulo persona curriculum pool size picks the next cell.';
COMMENT ON COLUMN public.gyan_bot_config.curriculum_batch_slot IS '1–5 within a coverage cycle; slot 5 forces a numerical / exam-setup style doubt.';

INSERT INTO public.gyan_curriculum_nodes (subject, class_level, sort_order, chapter_key, chapter_label, topic_key, topic_label, subtopic_key, subtopic_label, rag_query_hint)
VALUES
  ('Physics', 11, 1, 'ph11-u1', 'Units and Measurement', 'u1', 'Physical quantities', 'dim', 'Dimensional analysis', 'CBSE Class 11 Physics dimensional analysis formulas SI units'),
  ('Physics', 11, 2, 'ph11-u2', 'Motion in a Straight Line', 'u2', 'Kinematics', 'suvt', 'Equations of motion graphs', 'CBSE Class 11 kinematics v-t graphs displacement acceleration'),
  ('Physics', 11, 3, 'ph11-u3', 'Motion in a Plane', 'u3', 'Vectors', 'proj', 'Projectile motion range time of flight', 'CBSE Class 11 projectile motion range maximum height'),
  ('Physics', 12, 4, 'ph12-u1', 'Electric Charges and Fields', 'u1', 'Electrostatics', 'gauss', 'Electric flux Gauss law', 'CBSE Class 12 Gauss law electric flux symmetric surfaces'),
  ('Physics', 12, 5, 'ph12-u2', 'Electrostatic Potential', 'u2', 'Capacitance', 'cap', 'Parallel plate capacitor energy', 'CBSE Class 12 capacitor energy capacitance dielectric'),
  ('Chemistry', 11, 6, 'ch11-u1', 'Some Basic Concepts', 'u1', 'Mole concept', 'mol', 'Empirical molecular formula', 'CBSE Class 11 mole concept empirical formula stoichiometry'),
  ('Chemistry', 11, 7, 'ch11-u2', 'Structure of Atom', 'u2', 'Quantum numbers', 'qn', 'Orbitals Aufbau', 'CBSE Class 11 quantum numbers Aufbau principle electron configuration'),
  ('Chemistry', 12, 8, 'ch12-u1', 'Solutions', 'u1', 'Colligative properties', 'bp', 'Elevation of boiling point', 'CBSE Class 12 colligative properties molality boiling point elevation'),
  ('Chemistry', 12, 9, 'ch12-u2', 'Electrochemistry', 'u2', 'Cells', 'nernst', 'Nernst equation EMF', 'CBSE Class 12 Nernst equation cell EMF concentration'),
  ('Math', 11, 10, 'ma11-u1', 'Sets and Functions', 'u1', 'Functions', 'inv', 'Inverse composition', 'CBSE Class 11 functions domain range inverse composition'),
  ('Math', 11, 11, 'ma11-u2', 'Trigonometric Functions', 'u2', 'Identities', 'sum', 'sin cos sum identities', 'CBSE Class 11 trigonometric identities compound angles'),
  ('Math', 12, 12, 'ma12-u1', 'Continuity and Differentiability', 'u1', 'Derivatives', 'chain', 'Chain rule composite', 'CBSE Class 12 derivatives chain rule composite functions'),
  ('Math', 12, 13, 'ma12-u2', 'Integrals', 'u2', 'Definite integral', 'area', 'Area under curve', 'CBSE Class 12 definite integral area bounded region'),
  ('Biology', 11, 14, 'bi11-u1', 'The Living World', 'u1', 'Classification', 'taxa', 'Taxonomic categories', 'CBSE Class 11 biological classification hierarchy species genus'),
  ('Biology', 11, 15, 'bi11-u2', 'Cell: Unit of Life', 'u2', 'Cell structure', 'mito', 'Mitochondria plastids', 'CBSE Class 11 cell organelles mitochondria structure function'),
  ('Biology', 12, 16, 'bi12-u1', 'Principles of Inheritance', 'u1', 'Mendel', 'mono', 'Monohybrid cross ratios', 'CBSE Class 12 Mendelian genetics monohybrid ratio Punnett'),
  ('Biology', 12, 17, 'bi12-u2', 'Molecular Basis of Inheritance', 'u2', 'DNA', 'repl', 'DNA replication', 'CBSE Class 12 DNA replication leading lagging strand'),
  ('General Question', 11, 18, 'gen11', 'Cross-topic study skills', 'mix', 'Time management', 'plan', 'Board exam revision plan', 'CBSE Class 11 exam preparation revision timetable mixed subjects'),
  ('General Question', 12, 19, 'gen12', 'Exam strategy', 'strat', 'Numerical speed', 'speed', 'JEE-style time per question', 'CBSE Class 12 competitive exam time management numerical practice'),
  ('Other', 12, 20, 'oth12', 'Notation and conventions', 'sym', 'Symbols', 'chem', 'Chemistry symbols in physics context', 'CBSE Class 12 scientific notation units symbols interdisciplinary')
ON CONFLICT (sort_order) DO NOTHING;

ALTER TABLE public.gyan_curriculum_nodes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gyan_curriculum_nodes_select_authenticated ON public.gyan_curriculum_nodes;
CREATE POLICY gyan_curriculum_nodes_select_authenticated
  ON public.gyan_curriculum_nodes
  FOR SELECT
  TO authenticated
  USING (true);

GRANT SELECT ON public.gyan_curriculum_nodes TO authenticated;
GRANT SELECT ON public.gyan_curriculum_nodes TO service_role;
