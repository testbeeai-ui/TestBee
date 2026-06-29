-- Push updates to teacher portal when students submit assignments (Supabase Realtime).
-- Without publication, postgres_changes never fires and teachers only see updates on manual refresh.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'classroom_assignment_task_progress'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.classroom_assignment_task_progress;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'classroom_generated_test_attempts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.classroom_generated_test_attempts;
  END IF;
END $$;

ALTER TABLE public.classroom_assignment_task_progress REPLICA IDENTITY FULL;
ALTER TABLE public.classroom_generated_test_attempts REPLICA IDENTITY FULL;
