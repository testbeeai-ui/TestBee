-- RLS + privileges for student_section_history.
-- Required so posts RLS can evaluate temporal membership safely, without exposing other students' history.

BEGIN;

ALTER TABLE public.student_section_history ENABLE ROW LEVEL SECURITY;

-- Allow students to read their own section history.
DROP POLICY IF EXISTS "Students read own section history" ON public.student_section_history;
CREATE POLICY "Students read own section history"
  ON public.student_section_history FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Allow classroom teachers to read history for their classroom.
DROP POLICY IF EXISTS "Teachers read classroom section history" ON public.student_section_history;
CREATE POLICY "Teachers read classroom section history"
  ON public.student_section_history FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.classrooms c
      WHERE c.id = student_section_history.classroom_id
        AND c.teacher_id = auth.uid()
    )
  );

-- Minimal grants.
GRANT SELECT ON public.student_section_history TO authenticated;
GRANT SELECT ON public.student_section_history TO service_role;

COMMIT;

