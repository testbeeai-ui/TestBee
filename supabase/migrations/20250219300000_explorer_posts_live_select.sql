-- Allow teacher, members, and explorers to read posts and live_sessions.
-- If RLS was off before, enabling it would deny everyone; so we add all three read paths.

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;

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

-- Posts: explorers (10-min window)
DROP POLICY IF EXISTS "Explorers can read posts of class they are exploring" ON public.posts;
CREATE POLICY "Explorers can read posts of class they are exploring"
  ON public.posts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.class_exploration_sessions ces
      WHERE ces.classroom_id = posts.classroom_id
        AND ces.user_id = auth.uid()
        AND ces.started_at > now() - interval '10 minutes'
    )
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

-- Live sessions: explorers (10-min window)
DROP POLICY IF EXISTS "Explorers can read live_sessions of class they are exploring" ON public.live_sessions;
CREATE POLICY "Explorers can read live_sessions of class they are exploring"
  ON public.live_sessions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.class_exploration_sessions ces
      WHERE ces.classroom_id = live_sessions.classroom_id
        AND ces.user_id = auth.uid()
        AND ces.started_at > now() - interval '10 minutes'
    )
  );
