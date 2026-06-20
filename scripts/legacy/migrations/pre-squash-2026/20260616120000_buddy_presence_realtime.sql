-- Realtime for buddy presence: viewers refresh only when the paired user's row actually changes.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.student_learning_presence;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;
