-- Align existing students with new onboarding: both Class 11 & 12, exam on profile.
-- Default exam to CBSE when unset (matches Explore "no competitive filter").

UPDATE public.profiles
SET
  class_level = NULL,
  target_exam = COALESCE(NULLIF(trim(target_exam), ''), 'cbse')
WHERE role = 'student';
