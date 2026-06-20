-- Investor model: all Lessons chapters open (-1). Monetization is inside lesson panels (quiz, numerals, saves).

UPDATE public.rdm_config
SET value = -1,
    description = 'Free plan: all chapters open on Lessons (-1). Premium inside quiz/numerals/saves.'
WHERE key = 'free_lessons_chapter_limit';

UPDATE public.rdm_config
SET value = -1,
    description = 'Free Trial plan: all chapters open on Lessons (-1). Premium inside quiz/numerals/saves.'
WHERE key = 'free_trial_lessons_chapter_limit';

INSERT INTO public.rdm_config (key, value, description) VALUES
  ('free_lessons_chapter_limit', -1, 'Free plan: all chapters open on Lessons (-1). Premium inside quiz/numerals/saves.'),
  ('free_trial_lessons_chapter_limit', -1, 'Free Trial plan: all chapters open on Lessons (-1). Premium inside quiz/numerals/saves.')
ON CONFLICT (key) DO NOTHING;
