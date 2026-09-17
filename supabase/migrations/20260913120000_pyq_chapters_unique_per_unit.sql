-- Physics already occupies chapter_no 1–32. Mathematics reuses those numbers
-- inside its own unit, so uniqueness is (unit_id, chapter_no).

alter table pyq_chapters drop constraint if exists pyq_chapters_chapter_no_key;

do $$ begin
  alter table pyq_chapters add constraint pyq_chapters_unit_chapter_uniq unique (unit_id, chapter_no);
exception when duplicate_object then null;
end $$;

drop view if exists v_pyq_ingestion_check;

create view v_pyq_ingestion_check
with (security_invoker = true) as
select
  c.chapter_no,
  c.name,
  c.catalog_slug,
  u.name as unit_name,
  c.expected_question_count as expected,
  count(q.id) as actual,
  count(q.id) filter (where q.correct_option is null and q.numerical_answer is null) as missing_answer,
  count(q.id) filter (where q.review_status = 'flagged') as flagged,
  count(q.id) filter (where q.review_status = 'skeleton_only') as skeleton_only,
  count(q.id) filter (where q.review_status in ('auto_ok', 'human_ok')) as publishable,
  c.expected_question_count - count(q.id) as delta
from pyq_chapters c
left join pyq_units u on u.id = c.unit_id
left join pyq_questions q on q.chapter_id = c.id
group by c.id, c.chapter_no, c.name, c.catalog_slug, u.name, c.expected_question_count
order by u.name, c.chapter_no;
