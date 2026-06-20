-- Per-student completion rows for structured assignment tasks (posts.content_json.tasks).

CREATE TABLE IF NOT EXISTS public.classroom_assignment_task_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  task_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  completed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT classroom_assignment_task_progress_unique UNIQUE (post_id, task_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_catp_post_id ON public.classroom_assignment_task_progress(post_id);
CREATE INDEX IF NOT EXISTS idx_catp_user_post ON public.classroom_assignment_task_progress(post_id, user_id);

ALTER TABLE public.classroom_assignment_task_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catp_select_own_or_teacher" ON public.classroom_assignment_task_progress;
CREATE POLICY "catp_select_own_or_teacher"
  ON public.classroom_assignment_task_progress FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1
      FROM public.posts p
      JOIN public.classrooms c ON c.id = p.classroom_id
      WHERE p.id = classroom_assignment_task_progress.post_id
        AND c.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "catp_insert_own_member" ON public.classroom_assignment_task_progress;
CREATE POLICY "catp_insert_own_member"
  ON public.classroom_assignment_task_progress FOR INSERT
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

DROP POLICY IF EXISTS "catp_delete_own" ON public.classroom_assignment_task_progress;
CREATE POLICY "catp_delete_own"
  ON public.classroom_assignment_task_progress FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.classroom_assignment_task_progress IS 'Student checklist completion for assignment tasks stored on posts.content_json.tasks';
