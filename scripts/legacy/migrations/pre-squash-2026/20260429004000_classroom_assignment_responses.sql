-- Per-student free-form responses (text + links) for assignment tasks.
-- Keeps Mark-as-done via classroom_assignment_task_progress, but allows optional submissions.

BEGIN;

CREATE TABLE IF NOT EXISTS public.classroom_assignment_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id uuid NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  task_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  response_text text,
  links text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT classroom_assignment_responses_unique UNIQUE (post_id, task_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_car_post_id ON public.classroom_assignment_responses(post_id);
CREATE INDEX IF NOT EXISTS idx_car_user_post ON public.classroom_assignment_responses(post_id, user_id);

CREATE OR REPLACE FUNCTION public.set_classroom_assignment_responses_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_car_updated_at ON public.classroom_assignment_responses;
CREATE TRIGGER trg_car_updated_at
  BEFORE UPDATE ON public.classroom_assignment_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.set_classroom_assignment_responses_updated_at();

ALTER TABLE public.classroom_assignment_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "car_select_own_or_teacher" ON public.classroom_assignment_responses;
CREATE POLICY "car_select_own_or_teacher"
  ON public.classroom_assignment_responses FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1
      FROM public.posts p
      JOIN public.classrooms c ON c.id = p.classroom_id
      WHERE p.id = classroom_assignment_responses.post_id
        AND c.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "car_insert_own_member" ON public.classroom_assignment_responses;
CREATE POLICY "car_insert_own_member"
  ON public.classroom_assignment_responses FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.posts p
      JOIN public.classroom_members m ON m.classroom_id = p.classroom_id AND m.user_id = auth.uid()
      WHERE p.id = post_id
    )
  );

DROP POLICY IF EXISTS "car_update_own_member" ON public.classroom_assignment_responses;
CREATE POLICY "car_update_own_member"
  ON public.classroom_assignment_responses FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.posts p
      JOIN public.classroom_members m ON m.classroom_id = p.classroom_id AND m.user_id = auth.uid()
      WHERE p.id = classroom_assignment_responses.post_id
    )
  )
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.classroom_assignment_responses IS 'Optional student submissions (text + links) for assignment tasks stored on posts.content_json.tasks';

COMMIT;

