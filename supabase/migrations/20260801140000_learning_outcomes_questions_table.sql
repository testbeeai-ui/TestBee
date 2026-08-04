-- Dedicated Learning Outcomes MCQ packs (separate from subtopic_content jsonb).
create table if not exists public.learning_outcomes_questions (
  id uuid primary key default gen_random_uuid(),
  board text not null default 'CBSE',
  subject text not null,
  class_level integer not null check (class_level in (11, 12)),
  topic text not null,
  subtopic_name text not null,
  level text not null check (level in ('basics', 'intermediate', 'advanced')),
  questions jsonb not null default '[]'::jsonb,
  source text null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (board, subject, class_level, topic, subtopic_name, level)
);

create index if not exists learning_outcomes_questions_lookup_idx
  on public.learning_outcomes_questions (board, subject, class_level, topic, subtopic_name, level);

create index if not exists learning_outcomes_questions_subject_class_idx
  on public.learning_outcomes_questions (subject, class_level, topic);

alter table public.learning_outcomes_questions enable row level security;

drop policy if exists "learning_outcomes_questions_select_authenticated" on public.learning_outcomes_questions;
create policy "learning_outcomes_questions_select_authenticated"
  on public.learning_outcomes_questions for select
  to authenticated
  using (true);

drop policy if exists "learning_outcomes_questions_insert_admin" on public.learning_outcomes_questions;
create policy "learning_outcomes_questions_insert_admin"
  on public.learning_outcomes_questions for insert
  to authenticated
  with check (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'admin'::app_role
    )
  );

drop policy if exists "learning_outcomes_questions_update_admin" on public.learning_outcomes_questions;
create policy "learning_outcomes_questions_update_admin"
  on public.learning_outcomes_questions for update
  to authenticated
  using (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'admin'::app_role
    )
  )
  with check (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'admin'::app_role
    )
  );

comment on table public.learning_outcomes_questions is
  'Dive Learning Outcomes MCQ packs per subtopic (separate from Quiz bits_questions / Numerals practice_formulas).';

comment on column public.learning_outcomes_questions.questions is
  'Array of { question, options[], correctAnswer, solution }.';
