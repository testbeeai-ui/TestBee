-- Curriculum readable by all (anon + authenticated) so it loads reliably.
-- To restrict to signed-in users only, replace USING (true) with auth.role() = 'authenticated'.
DROP POLICY IF EXISTS "curriculum_units_select" ON public.curriculum_units;
DROP POLICY IF EXISTS "curriculum_chapters_select" ON public.curriculum_chapters;
DROP POLICY IF EXISTS "curriculum_topics_select" ON public.curriculum_topics;
DROP POLICY IF EXISTS "curriculum_subtopics_select" ON public.curriculum_subtopics;

CREATE POLICY "curriculum_units_select" ON public.curriculum_units FOR SELECT USING (true);
CREATE POLICY "curriculum_chapters_select" ON public.curriculum_chapters FOR SELECT USING (true);
CREATE POLICY "curriculum_topics_select" ON public.curriculum_topics FOR SELECT USING (true);
CREATE POLICY "curriculum_subtopics_select" ON public.curriculum_subtopics FOR SELECT USING (true);
