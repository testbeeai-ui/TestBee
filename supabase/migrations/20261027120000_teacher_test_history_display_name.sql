-- Teacher-chosen paper title. History falls back to topic or chapter when this is null.
alter table public.teacher_generated_test_history
  add column if not exists display_name text;

comment on column public.teacher_generated_test_history.display_name is
  'Paper name typed by the teacher. Shown on history cards ahead of the topic or chapter.';
