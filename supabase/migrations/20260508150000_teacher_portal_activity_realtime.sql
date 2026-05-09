-- Broadcast assignment/quiz activity to teachers via Supabase Realtime (RLS still applies).
-- Used by teacher portal silent refresh when students submit attempts or update task progress.
do $$
begin
  alter publication supabase_realtime add table public.classroom_generated_test_attempts;
exception
  when duplicate_object then
    null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.classroom_assignment_task_progress;
exception
  when duplicate_object then
    null;
end $$;
