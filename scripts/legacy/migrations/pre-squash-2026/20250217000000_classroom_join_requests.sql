-- Classroom join requests: students request to join; teachers approve or reject.
-- Only after approval is the student added to classroom_members.

CREATE TABLE IF NOT EXISTS public.classroom_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id uuid NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  responded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  UNIQUE(classroom_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_classroom_join_requests_classroom_id ON public.classroom_join_requests(classroom_id);
CREATE INDEX IF NOT EXISTS idx_classroom_join_requests_user_id ON public.classroom_join_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_classroom_join_requests_status ON public.classroom_join_requests(classroom_id, status) WHERE status = 'pending';

ALTER TABLE public.classroom_join_requests ENABLE ROW LEVEL SECURITY;

-- Students can create their own pending request
CREATE POLICY "Users can insert own join request"
  ON public.classroom_join_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

-- Students can read their own requests; teachers can read requests for their classrooms
CREATE POLICY "Users can read join requests for allowed context"
  ON public.classroom_join_requests FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.classrooms c
      WHERE c.id = classroom_join_requests.classroom_id AND c.teacher_id = auth.uid()
    )
  );

-- Only teacher of the classroom can update (approve/reject)
CREATE POLICY "Teachers can update join requests for their classroom"
  ON public.classroom_join_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.classrooms c
      WHERE c.id = classroom_join_requests.classroom_id AND c.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.classrooms c
      WHERE c.id = classroom_join_requests.classroom_id AND c.teacher_id = auth.uid()
    )
  );

COMMENT ON TABLE public.classroom_join_requests IS 'Student requests to join a classroom; teacher approves or rejects.';
