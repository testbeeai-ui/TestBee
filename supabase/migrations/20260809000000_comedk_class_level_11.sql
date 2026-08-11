-- Align COMEDK catalog metadata with other entrance exams (class_level 11).
-- Library listing is not gated by user class; this is catalog consistency only.
update public.past_papers
set class_level = 11
where exam_name = 'COMEDK'
  and class_level = 12;

update public.mock_papers
set class_level = 11
where exam_name = 'COMEDK'
  and class_level = 12;
