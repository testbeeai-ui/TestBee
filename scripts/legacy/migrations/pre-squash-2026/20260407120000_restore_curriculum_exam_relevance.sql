-- After 20260325200000_curriculum_cbse_guardrails cleared exam_relevance, competitive
-- exam filters in the app matched every topic (empty array was treated as universal).
-- Restore broad per-subject tags so JEE / KCET filters narrow Topic Rain and explore.

UPDATE public.curriculum_units
SET exam_relevance = CASE subject
  WHEN 'math' THEN ARRAY['JEE', 'KCET']::text[]
  WHEN 'physics' THEN ARRAY['JEE', 'NEET', 'KCET']::text[]
  WHEN 'chemistry' THEN ARRAY['JEE', 'NEET', 'KCET']::text[]
  WHEN 'biology' THEN ARRAY['JEE', 'NEET', 'KCET']::text[]
  ELSE exam_relevance
END
WHERE class_level IN (11, 12)
  AND subject IN ('physics', 'chemistry', 'math', 'biology')
  AND cardinality(exam_relevance) = 0;
