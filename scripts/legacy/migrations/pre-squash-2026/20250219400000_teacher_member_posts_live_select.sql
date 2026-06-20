-- If 20250219300000 already ran with only explorer policies, teacher/members lost read access.
-- This adds SELECT for teacher and members so they can see posts and live_sessions again.

-- Posts: teacher
DROP POLICY IF EXISTS "Teachers can read posts of their classroom" ON public.posts;
CREATE POLICY "Teachers can read posts of their classroom"
  ON public.posts FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.classrooms c WHERE c.id = posts.classroom_id AND c.teacher_id = auth.uid())
  );

-- Posts: members
DROP POLICY IF EXISTS "Members can read posts of their classroom" ON public.posts;
CREATE POLICY "Members can read posts of their classroom"
  ON public.posts FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.classroom_members cm WHERE cm.classroom_id = posts.classroom_id AND cm.user_id = auth.uid())
  );

-- Live sessions: teacher
DROP POLICY IF EXISTS "Teachers can read live_sessions of their classroom" ON public.live_sessions;
CREATE POLICY "Teachers can read live_sessions of their classroom"
  ON public.live_sessions FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.classrooms c WHERE c.id = live_sessions.classroom_id AND c.teacher_id = auth.uid())
  );

-- Live sessions: members
DROP POLICY IF EXISTS "Members can read live_sessions of their classroom" ON public.live_sessions;
CREATE POLICY "Members can read live_sessions of their classroom"
  ON public.live_sessions FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.classroom_members cm WHERE cm.classroom_id = live_sessions.classroom_id AND cm.user_id = auth.uid())
  );
