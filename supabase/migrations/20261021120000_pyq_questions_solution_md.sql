-- Worked solutions for Chapter PYQ (NTA Solution popup).
alter table pyq_questions
  add column if not exists solution_md text;

comment on column pyq_questions.solution_md is
  'Worked solution markdown with $KaTeX$. Null until pyq-solutions publishes a key-matched write-up.';
