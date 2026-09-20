-- Direction (tips) and formulae used on a PYQ. Null until a chapter is filled.
alter table pyq_questions
  add column if not exists tips_md text,
  add column if not exists formulas_md text;
