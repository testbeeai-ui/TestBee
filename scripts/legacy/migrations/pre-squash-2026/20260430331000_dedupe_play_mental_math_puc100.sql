-- Remove duplicate rows from running 20260430330000 twice (same content/options/explanation).
-- Keeps the oldest row per duplicate group (lowest created_at, then id).

DELETE FROM public.play_questions p
WHERE p.id IN (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY content, options, correct_answer_index, explanation
        ORDER BY created_at ASC NULLS LAST, id ASC
      ) AS rn
    FROM public.play_questions
    WHERE domain = 'funbrain'
      AND category = 'mental_math'
      AND (content->>'pack') = 'cbse_mental_math_puc100'
  ) sub
  WHERE sub.rn > 1
);
