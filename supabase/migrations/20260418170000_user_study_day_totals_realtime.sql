-- Live dashboard updates when study day totals change (StudentHomeDashboard postgres_changes).
alter publication supabase_realtime add table public.user_study_day_totals;
