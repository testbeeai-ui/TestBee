-- Referential integrity: attempts must reference a real mock paper.
-- NOT VALID + VALIDATE avoids long exclusive locks while building the constraint.

alter table public.mock_rdm_bonus_attempts
  add constraint mock_rdm_bonus_attempts_paper_id_fkey
  foreign key (paper_id)
  references public.mock_papers (id)
  on delete cascade
  not valid;

alter table public.mock_rdm_bonus_attempts
  validate constraint mock_rdm_bonus_attempts_paper_id_fkey;

-- Query patterns: filter by subject; list published mocks by class.

create index if not exists idx_mock_questions_subject
  on public.mock_questions (subject);

create index if not exists idx_mock_papers_class_published
  on public.mock_papers (class_level, published)
  where published = true;
