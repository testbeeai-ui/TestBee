-- Phase 2b: RLS initplan on next-hottest tables (Gyan+, classroom, live).

BEGIN;

-- doubt_answers
DROP POLICY IF EXISTS "Users can insert own doubt_answers" ON public.doubt_answers;
CREATE POLICY "Users can insert own doubt_answers"
  ON public.doubt_answers FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own doubt_answers" ON public.doubt_answers;
CREATE POLICY "Users can update own doubt_answers"
  ON public.doubt_answers FOR UPDATE TO authenticated
  USING (
    (select auth.uid()) = user_id
    AND is_accepted = false
    AND (SELECT is_resolved FROM public.doubts WHERE id = doubt_answers.doubt_id) = false
  );

DROP POLICY IF EXISTS "Users can delete own doubt_answers" ON public.doubt_answers;
CREATE POLICY "Users can delete own doubt_answers"
  ON public.doubt_answers FOR DELETE TO authenticated
  USING (
    (select auth.uid()) = user_id
    AND is_accepted = false
    AND (SELECT is_resolved FROM public.doubts WHERE id = doubt_answers.doubt_id) = false
  );

-- doubt_votes
DROP POLICY IF EXISTS "Users can read own doubt_votes" ON public.doubt_votes;
CREATE POLICY "Users can read own doubt_votes"
  ON public.doubt_votes FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own doubt_votes" ON public.doubt_votes;
CREATE POLICY "Users can insert own doubt_votes"
  ON public.doubt_votes FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own doubt_votes" ON public.doubt_votes;
CREATE POLICY "Users can delete own doubt_votes"
  ON public.doubt_votes FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- doubt_saves
DROP POLICY IF EXISTS "Users can manage own saves" ON public.doubt_saves;
CREATE POLICY "Users can manage own saves"
  ON public.doubt_saves FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- doubt_answer_reports
DROP POLICY IF EXISTS "Users can read own reports" ON public.doubt_answer_reports;
CREATE POLICY "Users can read own reports"
  ON public.doubt_answer_reports FOR SELECT TO authenticated
  USING ((select auth.uid()) = reporter_user_id);

DROP POLICY IF EXISTS "Users can insert own reports" ON public.doubt_answer_reports;
CREATE POLICY "Users can insert own reports"
  ON public.doubt_answer_reports FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = reporter_user_id);

-- classrooms (mutations; SELECT is open for explore)
DROP POLICY IF EXISTS "Teachers insert own classrooms" ON public.classrooms;
CREATE POLICY "Teachers insert own classrooms"
  ON public.classrooms FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = teacher_id);

DROP POLICY IF EXISTS "Teachers update own classrooms" ON public.classrooms;
CREATE POLICY "Teachers update own classrooms"
  ON public.classrooms FOR UPDATE TO authenticated
  USING ((select auth.uid()) = teacher_id)
  WITH CHECK ((select auth.uid()) = teacher_id);

DROP POLICY IF EXISTS "Teachers delete own classrooms" ON public.classrooms;
CREATE POLICY "Teachers delete own classrooms"
  ON public.classrooms FOR DELETE TO authenticated
  USING ((select auth.uid()) = teacher_id);

-- class_exploration_sessions (posts/live explorer reads)
DROP POLICY IF EXISTS "Users can read own class_exploration_sessions" ON public.class_exploration_sessions;
CREATE POLICY "Users can read own class_exploration_sessions"
  ON public.class_exploration_sessions FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own class_exploration_session" ON public.class_exploration_sessions;
CREATE POLICY "Users can insert own class_exploration_session"
  ON public.class_exploration_sessions FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- live_sessions
DROP POLICY IF EXISTS "Teachers can read live_sessions of their classroom" ON public.live_sessions;
CREATE POLICY "Teachers can read live_sessions of their classroom"
  ON public.live_sessions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.classrooms c
      WHERE c.id = live_sessions.classroom_id AND c.teacher_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Members can read live_sessions of their classroom" ON public.live_sessions;
CREATE POLICY "Members can read live_sessions of their classroom"
  ON public.live_sessions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.classroom_members cm
      WHERE cm.classroom_id = live_sessions.classroom_id AND cm.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Explorers can read live_sessions of class they are exploring" ON public.live_sessions;
CREATE POLICY "Explorers can read live_sessions of class they are exploring"
  ON public.live_sessions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.class_exploration_sessions ces
      WHERE ces.classroom_id = live_sessions.classroom_id
        AND ces.user_id = (select auth.uid())
        AND ces.started_at > now() - interval '10 minutes'
    )
  );

DROP POLICY IF EXISTS "Teachers insert live_sessions in their classroom" ON public.live_sessions;
CREATE POLICY "Teachers insert live_sessions in their classroom"
  ON public.live_sessions FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.uid()) = teacher_id
    AND EXISTS (
      SELECT 1 FROM public.classrooms c
      WHERE c.id = live_sessions.classroom_id AND c.teacher_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Teachers update own live_sessions" ON public.live_sessions;
CREATE POLICY "Teachers update own live_sessions"
  ON public.live_sessions FOR UPDATE TO authenticated
  USING ((select auth.uid()) = teacher_id)
  WITH CHECK ((select auth.uid()) = teacher_id);

DROP POLICY IF EXISTS "Teachers delete own live_sessions" ON public.live_sessions;
CREATE POLICY "Teachers delete own live_sessions"
  ON public.live_sessions FOR DELETE TO authenticated
  USING ((select auth.uid()) = teacher_id);

COMMIT;
