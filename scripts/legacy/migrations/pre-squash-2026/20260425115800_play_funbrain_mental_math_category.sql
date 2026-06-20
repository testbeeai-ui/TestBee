-- Step 1 of 3: register Funbrain Mental Math as a first-class play category.
-- Rows use domain = 'funbrain' and category = 'mental_math' (free-text category on play_questions).
-- Step 2 (115900) moves any mistaken academic/math CBSE rows; step 3 (120000) seeds the bank.
-- App: FunbrainCategory includes 'mental_math'; Play UI pill maps to this category (see app/play/page.tsx).

COMMENT ON COLUMN public.play_questions.category IS
'Bucket: academic — physics, chemistry, math, biology, cs; funbrain — puzzles, verbal, quantitative, analytical, mental_math (rapid CBSE-style drills, separate from academic Mathematics).';
