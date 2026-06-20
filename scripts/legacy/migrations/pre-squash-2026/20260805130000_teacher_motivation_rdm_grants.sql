-- Teacher → student motivation RDM: pending until linked assignment work is complete (policy A for non-linked nudges).

CREATE TABLE IF NOT EXISTS public.teacher_motivation_rdm_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  motivation_post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assignment_post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL,
  amount integer NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT teacher_motivation_rdm_grants_unique UNIQUE (motivation_post_id, student_id)
);

CREATE INDEX IF NOT EXISTS teacher_motivation_rdm_grants_student_assignment_pending_idx
  ON public.teacher_motivation_rdm_grants (student_id, assignment_post_id)
  WHERE status = 'pending';

ALTER TABLE public.teacher_motivation_rdm_grants ENABLE ROW LEVEL SECURITY;

-- Teachers read grants for their motivation posts; students read own grants.
CREATE POLICY teacher_motivation_grants_teacher_select ON public.teacher_motivation_rdm_grants
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = motivation_post_id AND p.teacher_id = auth.uid()
    )
  );

CREATE POLICY teacher_motivation_grants_student_select ON public.teacher_motivation_rdm_grants
  FOR SELECT
  USING (student_id = auth.uid());

COMMENT ON TABLE public.teacher_motivation_rdm_grants IS
  'Per-student RDM bonus from teacher motivation; paid when assignment_post_id work is complete.';
