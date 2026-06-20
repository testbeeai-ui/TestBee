-- Custom per-student assignment audience (targetStudentIds in posts.content_json)
-- Also remove the 10-minute exploration restriction from posts explorer policy.

BEGIN;

-- Members can read posts in their classroom + section, but if an assignment is targeted to specific students
-- then only those students (and the teacher) should see it.
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
    AND (
      NOT (
        posts.type IN ('assignment', 'quiz', 'mock', 'Concept Focus')
        AND jsonb_typeof(posts.content_json->'targetStudentIds') = 'array'
        AND jsonb_array_length(posts.content_json->'targetStudentIds') > 0
      )
      OR (posts.content_json->'targetStudentIds') ? (auth.uid()::text)
    )
  );

-- Explorers can read class-wide posts for classes they are exploring.
-- Do not expose section posts or custom-targeted assignments.
DROP POLICY IF EXISTS "Explorers can read posts of class they are exploring" ON public.posts;
CREATE POLICY "Explorers can read posts of class they are exploring"
  ON public.posts FOR SELECT TO authenticated
  USING (
    posts.section_id IS NULL
    AND EXISTS (
      SELECT 1 FROM public.class_exploration_sessions ces
      WHERE ces.classroom_id = posts.classroom_id
        AND ces.user_id = auth.uid()
    )
    AND (
      NOT (
        posts.type IN ('assignment', 'quiz', 'mock', 'Concept Focus')
        AND jsonb_typeof(posts.content_json->'targetStudentIds') = 'array'
        AND jsonb_array_length(posts.content_json->'targetStudentIds') > 0
      )
      OR (posts.content_json->'targetStudentIds') ? (auth.uid()::text)
    )
  );

COMMIT;

