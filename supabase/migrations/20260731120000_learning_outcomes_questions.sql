-- Learning Outcomes MCQs per sub-topic (self-check, separate from Dive Quiz bits_questions).
alter table public.subtopic_content
  add column if not exists learning_outcomes_questions jsonb not null default '[]'::jsonb;

comment on column public.subtopic_content.learning_outcomes_questions is
  'Self-check MCQs for Dive Learning Outcomes (question, options, correctAnswer, solution).';
