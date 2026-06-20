-- Section-scoped classroom posts (assignments, motivation, etc.)
-- A post can be class-wide (section_id NULL) or scoped to exactly one classroom_section.

BEGIN;

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS section_id uuid REFERENCES public.classroom_sections (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS posts_section_id_idx ON public.posts (section_id);
CREATE INDEX IF NOT EXISTS posts_classroom_id_section_id_idx ON public.posts (classroom_id, section_id);

-- ---------------------------------------------------------------------------
-- RLS: posts
-- Teachers can read all posts in their classroom (unchanged).
-- Members can read:
--  - class-wide posts (section_id IS NULL), plus
--  - section posts only when their membership section_id matches.
-- Explorers (10-min window) can only read class-wide posts (no section leakage).
-- Teachers can INSERT posts in their classroom, and if section_id is set it must belong to the same classroom.
-- ---------------------------------------------------------------------------

-- Posts: members (replace policy to include section match)
DROP POLICY IF EXISTS "Members can read posts of their classroom" ON public.posts;
CREATE POLICY "Members can read posts of their classroom"
  ON public.posts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.classroom_members cm
      WHERE cm.classroom_id = posts.classroom_id
        AND cm.user_id = auth.uid()
        AND (
          posts.section_id IS NULL
          OR posts.section_id = cm.section_id
        )
    )
  );

-- Posts: explorers (replace policy to restrict to class-wide only)
DROP POLICY IF EXISTS "Explorers can read posts of class they are exploring" ON public.posts;
CREATE POLICY "Explorers can read posts of class they are exploring"
  ON public.posts FOR SELECT TO authenticated
  USING (
    posts.section_id IS NULL
    AND EXISTS (
      SELECT 1 FROM public.class_exploration_sessions ces
      WHERE ces.classroom_id = posts.classroom_id
        AND ces.user_id = auth.uid()
        AND ces.started_at > now() - interval '10 minutes'
    )
  );

-- Posts: teacher insert (replace policy to validate section/classroom pairing)
DROP POLICY IF EXISTS "Teachers insert posts in their classroom" ON public.posts;
CREATE POLICY "Teachers insert posts in their classroom"
  ON public.posts FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = teacher_id
    AND EXISTS (
      SELECT 1 FROM public.classrooms c
      WHERE c.id = posts.classroom_id AND c.teacher_id = auth.uid()
    )
    AND (
      posts.section_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.classroom_sections s
        WHERE s.id = posts.section_id AND s.classroom_id = posts.classroom_id
      )
    )
  );

COMMIT;

