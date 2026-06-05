-- Let students read an assignment post when their teacher nudged them about it (or issued an RDM grant),
-- even if section-history timing would otherwise hide the post. Fixes bell → Open → empty Posts.

BEGIN;

DROP POLICY IF EXISTS "Members can read posts of their classroom" ON public.posts;
CREATE POLICY "Members can read posts of their classroom"
  ON public.posts FOR SELECT TO authenticated
  USING (
    (
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
            OR (
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
          posts.type IN ('assignment', 'quiz', 'mock', 'past_paper', 'Concept Focus')
          AND COALESCE(jsonb_typeof(posts.content_json->'targetStudentIds'), '') = 'array'
          AND COALESCE(jsonb_array_length(posts.content_json->'targetStudentIds'), 0) > 0
        )
        OR (posts.content_json->'targetStudentIds') ? (auth.uid()::text)
      )
    )
    OR EXISTS (
      SELECT 1
      FROM public.teacher_motivation_rdm_grants g
      WHERE g.student_id = auth.uid()
        AND g.assignment_post_id = posts.id
        AND g.status IN ('pending', 'paid')
    )
    OR EXISTS (
      SELECT 1
      FROM public.posts m
      WHERE m.type = 'motivation'
        AND m.classroom_id = posts.classroom_id
        AND COALESCE(m.content_json->>'relatedPostId', '') = posts.id::text
        AND COALESCE(jsonb_typeof(m.content_json->'targetStudentIds'), '') = 'array'
        AND COALESCE(jsonb_array_length(m.content_json->'targetStudentIds'), 0) > 0
        AND (m.content_json->'targetStudentIds') ? (auth.uid()::text)
    )
  );

COMMIT;
