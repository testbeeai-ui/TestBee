-- Teacher-funded subtopic unlock (Concept Focus): one grant per targeted student at publish.

INSERT INTO public.rdm_config (key, value, description)
VALUES (
  'teacher_subtopic_unlock_rdm_per_student',
  10,
  'RDM per student to unlock a Concept Focus subtopic for the assignment audience'
)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.classroom_subtopic_unlock_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount_rdm integer NOT NULL CHECK (amount_rdm > 0),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'cancelled', 'refunded')),
  chapter_quiz jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT classroom_subtopic_unlock_grants_unique
    UNIQUE (assignment_post_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_csugrants_assignment_post
  ON public.classroom_subtopic_unlock_grants (assignment_post_id);

CREATE INDEX IF NOT EXISTS idx_csugrants_student_active
  ON public.classroom_subtopic_unlock_grants (student_id, assignment_post_id)
  WHERE status = 'active';

COMMENT ON TABLE public.classroom_subtopic_unlock_grants IS
  'Teacher pays per student at Concept Focus publish; unlocks full subtopic for that assignment.';

ALTER TABLE public.classroom_subtopic_unlock_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY csugrants_select_teacher_own
  ON public.classroom_subtopic_unlock_grants
  FOR SELECT TO authenticated
  USING (teacher_id = auth.uid());

CREATE POLICY csugrants_select_student_own
  ON public.classroom_subtopic_unlock_grants
  FOR SELECT TO authenticated
  USING (student_id = auth.uid());
