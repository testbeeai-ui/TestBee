-- Remove the Mathematics PYQ bank. Physics rows stay.
-- Also drop unused ingest audit objects so the Table Editor is only the live bank.

delete from pyq_questions
where chapter_id in (
  select c.id
  from pyq_chapters c
  join pyq_units u on u.id = c.unit_id
  join pyq_subjects s on s.id = u.subject_id
  where s.name = 'Mathematics'
);

delete from pyq_figures
where storage_path like 'pyq/math/%';

delete from pyq_topics
where chapter_id in (
  select c.id
  from pyq_chapters c
  join pyq_units u on u.id = c.unit_id
  join pyq_subjects s on s.id = u.subject_id
  where s.name = 'Mathematics'
);

delete from pyq_chapters
where unit_id in (
  select u.id
  from pyq_units u
  join pyq_subjects s on s.id = u.subject_id
  where s.name = 'Mathematics'
);

delete from pyq_units
where subject_id in (select id from pyq_subjects where name = 'Mathematics');

delete from pyq_subjects
where name = 'Mathematics';

drop view if exists v_pyq_ingestion_check;

drop table if exists pyq_ingestion_runs;
