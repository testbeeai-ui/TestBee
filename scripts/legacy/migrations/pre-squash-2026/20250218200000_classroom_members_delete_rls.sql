-- Teachers can remove (delete) a member from their classroom (e.g. misbehaving student).

DROP POLICY IF EXISTS "Teachers can remove members from their classroom" ON public.classroom_members;
CREATE POLICY "Teachers can remove members from their classroom"
  ON public.classroom_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.classrooms c
      WHERE c.id = classroom_members.classroom_id AND c.teacher_id = auth.uid()
    )
  );
