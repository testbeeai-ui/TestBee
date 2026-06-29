-- Link Gyan++ assignment task progress to the student doubt that completed it.

ALTER TABLE public.classroom_assignment_task_progress
  ADD COLUMN IF NOT EXISTS doubt_id uuid REFERENCES public.doubts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_catp_doubt_id
  ON public.classroom_assignment_task_progress (doubt_id)
  WHERE doubt_id IS NOT NULL;

COMMENT ON COLUMN public.classroom_assignment_task_progress.doubt_id IS
  'When set, the Gyan++ doubt that satisfied a gyan_engagement assignment task.';
