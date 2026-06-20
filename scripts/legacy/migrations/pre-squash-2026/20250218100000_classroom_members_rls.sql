-- Allow teachers to add members when approving join requests (and for invite/join flows).
-- Error: "new row violates row-level security policy for table 'classroom_members'"

ALTER TABLE public.classroom_members ENABLE ROW LEVEL SECURITY;

-- Teachers can insert a member into their own classroom (approve request or invite)
DROP POLICY IF EXISTS "Teachers can add members to their classroom" ON public.classroom_members;
CREATE POLICY "Teachers can add members to their classroom"
  ON public.classroom_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.classrooms c
      WHERE c.id = classroom_members.classroom_id AND c.teacher_id = auth.uid()
    )
  );

-- Allow users to join via join code (student inserts themselves for a classroom they have access to via join)
DROP POLICY IF EXISTS "Users can join classroom as student" ON public.classroom_members;
CREATE POLICY "Users can join classroom as student"
  ON public.classroom_members FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND role = 'student');

-- Members and teacher can read classroom_members for their classrooms
DROP POLICY IF EXISTS "Users can read members of their classrooms" ON public.classroom_members;
CREATE POLICY "Users can read members of their classrooms"
  ON public.classroom_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.classroom_members m2
      WHERE m2.classroom_id = classroom_members.classroom_id AND m2.user_id = auth.uid()
    )
  );
