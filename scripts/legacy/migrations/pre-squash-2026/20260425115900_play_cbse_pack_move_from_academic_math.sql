-- Between category comment (115800) and question seed (120000): move mistaken academic/math CBSE rows.
-- If an older revision stored the CBSE bank under academic/math (explanation delimiters $qNNNN$ from generator),
-- move those rows into funbrain/mental_math so the next migration can REPLACE the bank in one category.
-- Flat rating 1000 (mental pool does not use per-question scores; see 20260425121000).

BEGIN;

UPDATE public.play_questions q
SET
  domain = 'funbrain',
  category = 'mental_math',
  difficulty_rating = 1000,
  content = COALESCE(q.content, '{}'::jsonb) || jsonb_build_object('pack', 'cbse_mental_math')
WHERE q.domain = 'academic'
  AND q.category = 'math'
  AND q.explanation ~ '^[$]q[0-9]{4}[$]';

COMMIT;
