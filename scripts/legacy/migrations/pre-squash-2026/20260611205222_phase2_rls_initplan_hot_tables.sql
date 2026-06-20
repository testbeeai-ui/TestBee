-- Phase 2: RLS initplan fix on hottest tables — wrap auth.uid() as (select auth.uid())
-- so Postgres evaluates it once per query, not per row.

BEGIN;

-- Posts helper functions (invoked from policies)
CREATE OR REPLACE FUNCTION public.student_has_active_grant_for_assignment(p_post_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.teacher_motivation_rdm_grants g
    WHERE g.student_id = (select auth.uid())
      AND g.assignment_post_id = p_post_id
      AND g.status IN ('pending', 'paid')
  );
$$;

CREATE OR REPLACE FUNCTION public.student_can_read_post_via_teacher_nudge(
  p_post_id uuid,
  p_classroom_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.posts m
    WHERE m.type = 'motivation'
      AND m.classroom_id = p_classroom_id
      AND COALESCE(m.content_json->>'relatedPostId', '') = p_post_id::text
      AND COALESCE(jsonb_typeof(m.content_json->'targetStudentIds'), '') = 'array'
      AND COALESCE(jsonb_array_length(m.content_json->'targetStudentIds'), 0) > 0
      AND (m.content_json->'targetStudentIds') ? ((select auth.uid())::text)
  );
$$;

CREATE OR REPLACE FUNCTION public.teacher_owns_motivation_post(p_motivation_post_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.posts p
    WHERE p.id = p_motivation_post_id
      AND p.teacher_id = (select auth.uid())
  );
$$;

-- classroom_members
DROP POLICY IF EXISTS "Users can read members of their classrooms" ON public.classroom_members;
CREATE POLICY "Users can read members of their classrooms"
  ON public.classroom_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.classrooms c
      WHERE c.id = classroom_members.classroom_id AND c.teacher_id = (select auth.uid())
    )
    OR public.user_is_member_of_classroom(classroom_members.classroom_id, (select auth.uid()))
  );

DROP POLICY IF EXISTS "Users can join classroom as student" ON public.classroom_members;
CREATE POLICY "Users can join classroom as student"
  ON public.classroom_members FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id AND role = 'student');

DROP POLICY IF EXISTS "Teachers can add members to their classroom" ON public.classroom_members;
CREATE POLICY "Teachers can add members to their classroom"
  ON public.classroom_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.classrooms c
      WHERE c.id = classroom_members.classroom_id AND c.teacher_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Teachers can remove members from their classroom" ON public.classroom_members;
CREATE POLICY "Teachers can remove members from their classroom"
  ON public.classroom_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.classrooms c
      WHERE c.id = classroom_members.classroom_id AND c.teacher_id = (select auth.uid())
    )
  );

-- profiles
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));

-- doubts
DROP POLICY IF EXISTS "Users can insert own doubts" ON public.doubts;
CREATE POLICY "Users can insert own doubts"
  ON public.doubts FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own doubts" ON public.doubts;
CREATE POLICY "Users can update own doubts"
  ON public.doubts FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id AND is_resolved = false);

DROP POLICY IF EXISTS "Users can delete own doubts" ON public.doubts;
CREATE POLICY "Users can delete own doubts"
  ON public.doubts FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id AND is_resolved = false);

-- posts
DROP POLICY IF EXISTS "Teachers can read posts of their classroom" ON public.posts;
CREATE POLICY "Teachers can read posts of their classroom"
  ON public.posts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.classrooms c
      WHERE c.id = posts.classroom_id AND c.teacher_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Members can read posts of their classroom" ON public.posts;
CREATE POLICY "Members can read posts of their classroom"
  ON public.posts FOR SELECT TO authenticated
  USING (
    (
      EXISTS (
        SELECT 1
        FROM public.student_section_history ssh
        WHERE ssh.classroom_id = posts.classroom_id
          AND ssh.user_id = (select auth.uid())
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
        OR (posts.content_json->'targetStudentIds') ? ((select auth.uid())::text)
      )
    )
    OR public.student_has_active_grant_for_assignment(posts.id)
    OR public.student_can_read_post_via_teacher_nudge(posts.id, posts.classroom_id)
  );

DROP POLICY IF EXISTS "Explorers can read posts of class they are exploring" ON public.posts;
CREATE POLICY "Explorers can read posts of class they are exploring"
  ON public.posts FOR SELECT TO authenticated
  USING (
    posts.section_id IS NULL
    AND EXISTS (
      SELECT 1 FROM public.class_exploration_sessions ces
      WHERE ces.classroom_id = posts.classroom_id
        AND ces.user_id = (select auth.uid())
    )
    AND (
      NOT (
        posts.type IN ('assignment', 'quiz', 'mock', 'Concept Focus')
        AND jsonb_typeof(posts.content_json->'targetStudentIds') = 'array'
        AND jsonb_array_length(posts.content_json->'targetStudentIds') > 0
      )
      OR (posts.content_json->'targetStudentIds') ? ((select auth.uid())::text)
    )
  );

DROP POLICY IF EXISTS "Teachers insert posts in their classroom" ON public.posts;
CREATE POLICY "Teachers insert posts in their classroom"
  ON public.posts FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) = teacher_id
    AND EXISTS (
      SELECT 1 FROM public.classrooms c
      WHERE c.id = posts.classroom_id AND c.teacher_id = (select auth.uid())
    )
    AND (
      posts.section_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.classroom_sections s
        WHERE s.id = posts.section_id AND s.classroom_id = posts.classroom_id
      )
    )
  );

DROP POLICY IF EXISTS "Teachers update own posts" ON public.posts;
CREATE POLICY "Teachers update own posts"
  ON public.posts FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = teacher_id)
  WITH CHECK ((select auth.uid()) = teacher_id);

DROP POLICY IF EXISTS "Teachers delete own posts" ON public.posts;
CREATE POLICY "Teachers delete own posts"
  ON public.posts FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = teacher_id);

COMMIT;
