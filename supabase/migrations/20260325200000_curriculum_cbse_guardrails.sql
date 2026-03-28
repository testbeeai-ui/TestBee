-- CBSE curriculum guardrails:
-- 1) clear exam_relevance tags for current Class 11/12 curriculum rows
-- 2) enforce clean text/allowed values for future writes

UPDATE public.curriculum_units
SET exam_relevance = '{}'::text[]
WHERE class_level IN (11, 12)
  AND subject IN ('physics', 'chemistry', 'math', 'biology');

ALTER TABLE public.curriculum_units
  ADD CONSTRAINT curriculum_units_subject_allowed
  CHECK (subject IN ('physics', 'chemistry', 'math', 'biology')) NOT VALID;

ALTER TABLE public.curriculum_units
  ADD CONSTRAINT curriculum_units_class_level_allowed
  CHECK (class_level IN (11, 12)) NOT VALID;

ALTER TABLE public.curriculum_units
  ADD CONSTRAINT curriculum_units_unit_label_nonempty
  CHECK (length(btrim(unit_label)) > 0) NOT VALID;

ALTER TABLE public.curriculum_units
  ADD CONSTRAINT curriculum_units_unit_title_nonempty
  CHECK (length(btrim(unit_title)) > 0) NOT VALID;

ALTER TABLE public.curriculum_chapters
  ADD CONSTRAINT curriculum_chapters_title_nonempty
  CHECK (length(btrim(title)) > 0) NOT VALID;

ALTER TABLE public.curriculum_topics
  ADD CONSTRAINT curriculum_topics_title_nonempty
  CHECK (length(btrim(title)) > 0) NOT VALID;

ALTER TABLE public.curriculum_subtopics
  ADD CONSTRAINT curriculum_subtopics_name_nonempty
  CHECK (length(btrim(name)) > 0) NOT VALID;

CREATE OR REPLACE FUNCTION public.prevent_duplicate_subtopic_names()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.name := btrim(NEW.name);

  IF EXISTS (
    SELECT 1
    FROM public.curriculum_subtopics s
    WHERE s.topic_id = NEW.topic_id
      AND lower(btrim(s.name)) = lower(NEW.name)
      AND (NEW.id IS NULL OR s.id <> NEW.id)
  ) THEN
    RAISE EXCEPTION 'Duplicate subtopic "%" for topic_id %', NEW.name, NEW.topic_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_duplicate_subtopic_names ON public.curriculum_subtopics;

CREATE TRIGGER trg_prevent_duplicate_subtopic_names
BEFORE INSERT OR UPDATE ON public.curriculum_subtopics
FOR EACH ROW
EXECUTE FUNCTION public.prevent_duplicate_subtopic_names();

