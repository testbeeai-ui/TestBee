-- Stores per-student attempts for teacher-generated classroom MCQ assignments.

CREATE TABLE IF NOT EXISTS public.classroom_generated_test_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  classroom_id uuid NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  answers_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  score integer NOT NULL DEFAULT 0,
  total integer NOT NULL DEFAULT 0,
  submitted_at timestamptz NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT classroom_generated_test_attempts_unique UNIQUE (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_cgta_post_id ON public.classroom_generated_test_attempts(post_id);
CREATE INDEX IF NOT EXISTS idx_cgta_user_id ON public.classroom_generated_test_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_cgta_classroom_id ON public.classroom_generated_test_attempts(classroom_id);

ALTER TABLE public.classroom_generated_test_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cgta_select_own_or_teacher" ON public.classroom_generated_test_attempts;
CREATE POLICY "cgta_select_own_or_teacher"
  ON public.classroom_generated_test_attempts FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1
      FROM public.posts p
      JOIN public.classrooms c ON c.id = p.classroom_id
      WHERE p.id = classroom_generated_test_attempts.post_id
        AND c.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "cgta_insert_own_member" ON public.classroom_generated_test_attempts;
CREATE POLICY "cgta_insert_own_member"
  ON public.classroom_generated_test_attempts FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.classroom_members m
      WHERE m.classroom_id = classroom_generated_test_attempts.classroom_id
        AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "cgta_update_own_member" ON public.classroom_generated_test_attempts;
CREATE POLICY "cgta_update_own_member"
  ON public.classroom_generated_test_attempts FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.classroom_members m
      WHERE m.classroom_id = classroom_generated_test_attempts.classroom_id
        AND m.user_id = auth.uid()
    )
  )
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.classroom_generated_test_attempts IS 'Student attempts for teacher-generated MCQ assignment tests.';
