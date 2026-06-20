-- Curriculum tables: units -> chapters -> topics -> subtopics
-- Stores Class 11/12 PCM syllabi (Unit -> Chapter -> Topic -> Subtopic hierarchy)

CREATE TABLE IF NOT EXISTS public.curriculum_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL,
  class_level integer NOT NULL,
  unit_label text NOT NULL,
  unit_title text NOT NULL,
  exam_relevance text[] NOT NULL DEFAULT '{}',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subject, class_level, unit_label)
);

CREATE TABLE IF NOT EXISTS public.curriculum_chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.curriculum_units (id) ON DELETE CASCADE,
  title text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unit_id, title)
);

CREATE TABLE IF NOT EXISTS public.curriculum_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES public.curriculum_chapters (id) ON DELETE CASCADE,
  title text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chapter_id, title)
);

CREATE TABLE IF NOT EXISTS public.curriculum_subtopics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES public.curriculum_topics (id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_curriculum_units_subject_class
  ON public.curriculum_units (subject, class_level);

CREATE INDEX IF NOT EXISTS idx_curriculum_chapters_unit
  ON public.curriculum_chapters (unit_id);

CREATE INDEX IF NOT EXISTS idx_curriculum_topics_chapter
  ON public.curriculum_topics (chapter_id);

CREATE INDEX IF NOT EXISTS idx_curriculum_subtopics_topic
  ON public.curriculum_subtopics (topic_id);

-- RLS: curriculum is read-only for all authenticated and anon users
ALTER TABLE public.curriculum_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curriculum_chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curriculum_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curriculum_subtopics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "curriculum_units_select" ON public.curriculum_units;
DROP POLICY IF EXISTS "curriculum_chapters_select" ON public.curriculum_chapters;
DROP POLICY IF EXISTS "curriculum_topics_select" ON public.curriculum_topics;
DROP POLICY IF EXISTS "curriculum_subtopics_select" ON public.curriculum_subtopics;

CREATE POLICY "curriculum_units_select" ON public.curriculum_units FOR SELECT USING (true);
CREATE POLICY "curriculum_chapters_select" ON public.curriculum_chapters FOR SELECT USING (true);
CREATE POLICY "curriculum_topics_select" ON public.curriculum_topics FOR SELECT USING (true);
CREATE POLICY "curriculum_subtopics_select" ON public.curriculum_subtopics FOR SELECT USING (true);
