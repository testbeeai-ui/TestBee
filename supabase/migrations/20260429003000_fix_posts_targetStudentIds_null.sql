-- Fix posts RLS: NULL-safe custom audience check.
-- When content_json->targetStudentIds is missing/null, previous policy could evaluate to NULL,
-- which is treated as FALSE by RLS, hiding otherwise-visible posts.

BEGIN;

DROP POLICY IF EXISTS "Members can read posts of their classroom" ON public.posts;
CREATE POLICY "Members can read posts of their classroom"
  ON public.posts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.student_section_history ssh
      WHERE ssh.classroom_id = posts.classroom_id
        AND ssh.user_id = auth.uid()
        AND (
          (
            posts.section_id IS NULL
            AND posts.created_at >= ssh.joined_at
            AND (ssh.left_at IS NULL OR posts.created_at <= ssh.left_at)
          )
          OR
          (
            posts.section_id = ssh.section_id
            AND (
              (
                posts.created_at >= ssh.joined_at
                AND (ssh.left_at IS NULL OR posts.created_at <= ssh.left_at)
              )
              OR (
                posts.created_at < ssh.joined_at
                AND posts.due_date IS NOT NULL
                AND posts.due_date > ssh.joined_at
              )
            )
          )
        )
    )
    AND (
      NOT (
        posts.type IN ('assignment', 'quiz', 'mock', 'Concept Focus')
        AND COALESCE(jsonb_typeof(posts.content_json->'targetStudentIds'), '') = 'array'
        AND COALESCE(jsonb_array_length(posts.content_json->'targetStudentIds'), 0) > 0
      )
      OR (posts.content_json->'targetStudentIds') ? (auth.uid()::text)
    )
  );

COMMIT;

