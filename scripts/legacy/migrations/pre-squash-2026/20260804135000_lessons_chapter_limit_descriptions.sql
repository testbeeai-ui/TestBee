-- Clarify lessons chapter limit: per subject on /explore-1, not monthly.

UPDATE public.rdm_config
SET description = 'Max chapters unlockable per PCM subject on Lessons (/explore-1). Separate cap for Physics, Chemistry, and Math. Not monthly. One class (11 or 12) per subject. -1 = unlimited (disables chapter lock).'
WHERE key IN (
  'free_lessons_chapter_limit',
  'free_trial_lessons_chapter_limit',
  'starter_lessons_chapter_limit',
  'pro_lessons_chapter_limit'
);
