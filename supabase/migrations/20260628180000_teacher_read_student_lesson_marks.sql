-- Teachers need lesson-mark rows to show Concept Focus assignment completion in the portal.
-- Students write here from /api/user/subtopic-engagement; profiles.subtopic_engagement may be empty.

CREATE POLICY "Teachers read classroom student lesson marks"
  ON public.student_lesson_mark_completions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.classroom_members cm_student
      INNER JOIN public.classroom_members cm_teacher
        ON cm_teacher.classroom_id = cm_student.classroom_id
      INNER JOIN public.classrooms c
        ON c.id = cm_student.classroom_id
      WHERE cm_student.user_id = student_lesson_mark_completions.user_id
        AND lower(cm_student.role::text) = 'student'
        AND cm_teacher.user_id = auth.uid()
        AND lower(cm_teacher.role::text) = 'teacher'
        AND c.teacher_id = auth.uid()
    )
  );
