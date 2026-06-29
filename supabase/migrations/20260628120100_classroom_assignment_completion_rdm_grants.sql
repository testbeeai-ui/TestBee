-- Teacher-funded per-student completion rewards (escrow at publish, pay on complete, refund after due).

CREATE TABLE IF NOT EXISTS public.classroom_assignment_completion_rdm_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount integer NOT NULL CHECK (amount > 0),
  due_at timestamptz,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'refunded', 'cancelled')),
  paid_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT classroom_assignment_completion_rdm_grants_unique
    UNIQUE (assignment_post_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_cacrg_assignment_post
  ON public.classroom_assignment_completion_rdm_grants (assignment_post_id);

CREATE INDEX IF NOT EXISTS idx_cacrg_teacher_status
  ON public.classroom_assignment_completion_rdm_grants (teacher_id, status);

CREATE INDEX IF NOT EXISTS idx_cacrg_student_pending
  ON public.classroom_assignment_completion_rdm_grants (student_id, assignment_post_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_cacrg_refund_due
  ON public.classroom_assignment_completion_rdm_grants (status, due_at)
  WHERE status = 'pending' AND due_at IS NOT NULL;

COMMENT ON TABLE public.classroom_assignment_completion_rdm_grants IS
  'Teacher escrow: one row per targeted student; paid on assignment completion before due_at; refunded after due_at if still pending.';

ALTER TABLE public.classroom_assignment_completion_rdm_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY cacrg_select_teacher_own
  ON public.classroom_assignment_completion_rdm_grants
  FOR SELECT TO authenticated
  USING (teacher_id = auth.uid());

CREATE POLICY cacrg_select_student_own
  ON public.classroom_assignment_completion_rdm_grants
  FOR SELECT TO authenticated
  USING (student_id = auth.uid());
