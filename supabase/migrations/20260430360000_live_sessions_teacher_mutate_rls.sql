-- live_sessions had RLS + SELECT policies but no INSERT/UPDATE/DELETE for teachers.
-- Creating a classroom with a schedule (or scheduling from My Classes) failed with:
-- "new row violates row-level security policy for table live_sessions"

DROP POLICY IF EXISTS "Teachers insert live_sessions in their classroom" ON public.live_sessions;
CREATE POLICY "Teachers insert live_sessions in their classroom"
  ON public.live_sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = teacher_id
    AND EXISTS (
      SELECT 1 FROM public.classrooms c
      WHERE c.id = live_sessions.classroom_id AND c.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Teachers update own live_sessions" ON public.live_sessions;
CREATE POLICY "Teachers update own live_sessions"
  ON public.live_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = teacher_id)
  WITH CHECK (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "Teachers delete own live_sessions" ON public.live_sessions;
CREATE POLICY "Teachers delete own live_sessions"
  ON public.live_sessions FOR DELETE
  TO authenticated
  USING (auth.uid() = teacher_id);
