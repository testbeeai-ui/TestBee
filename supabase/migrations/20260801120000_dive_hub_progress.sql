-- Dive hub completion + assessment scores (one row per user per subtopic).
create table if not exists public.dive_hub_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  storage_key text not null,
  completed text[] not null default '{}'::text[],
  quiz_score smallint null check (quiz_score is null or (quiz_score >= 0 and quiz_score <= 100)),
  numeral_score smallint null check (numeral_score is null or (numeral_score >= 0 and numeral_score <= 100)),
  outcomes_score smallint null check (outcomes_score is null or (outcomes_score >= 0 and outcomes_score <= 100)),
  updated_at timestamptz not null default now(),
  primary key (user_id, storage_key)
);

create index if not exists dive_hub_progress_user_updated_idx
  on public.dive_hub_progress (user_id, updated_at desc);

alter table public.dive_hub_progress enable row level security;

drop policy if exists "dive_hub_progress_select_own" on public.dive_hub_progress;
create policy "dive_hub_progress_select_own"
  on public.dive_hub_progress for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "dive_hub_progress_insert_own" on public.dive_hub_progress;
create policy "dive_hub_progress_insert_own"
  on public.dive_hub_progress for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "dive_hub_progress_update_own" on public.dive_hub_progress;
create policy "dive_hub_progress_update_own"
  on public.dive_hub_progress for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.dive_hub_progress is
  'Dive hub activity completion + Quiz/Numerals/Outcomes scores; one row per user per subtopic key.';
