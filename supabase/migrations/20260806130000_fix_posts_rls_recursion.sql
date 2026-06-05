-- Fix infinite recursion: posts RLS must not subquery posts directly.
-- Use SECURITY DEFINER helper to read motivation rows without re-entering posts policies.

BEGIN;

CREATE OR REPLACE FUNCTION public.student_can_read_post_via_teacher_nudge(
  p_post_id uuid,
  p_classroom_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.posts m
    WHERE m.type = 'motivation'
      AND m.classroom_id = p_classroom_id
      AND COALESCE(m.content_json->>'relatedPostId', '') = p_post_id::text
      AND COALESCE(jsonb_typeof(m.content_json->'targetStudentIds'), '') = 'array'
      AND COALESCE(jsonb_array_length(m.content_json->'targetStudentIds'), 0) > 0
      AND (m.content_json->'targetStudentIds') ? (auth.uid()::text)
  );
$$;

REVOKE ALL ON FUNCTION public.student_can_read_post_via_teacher_nudge(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.student_can_read_post_via_teacher_nudge(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.student_can_read_post_via_teacher_nudge IS
  'True when the current user was nudged (motivation post) about p_post_id; used by posts SELECT RLS without recursion.';

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
    OR public.student_can_read_post_via_teacher_nudge(posts.id, posts.classroom_id)
  );

COMMIT;
