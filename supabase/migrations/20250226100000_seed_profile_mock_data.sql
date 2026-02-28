-- Seed mock profile data: ensure profiles exist for doubt authors, add academics & achievements.
-- Run: supabase db push, or execute in Supabase Dashboard → SQL Editor.

-- 1. Ensure profiles exist for all user_ids in doubts/doubt_answers that exist in auth.users
--    (handle_new_user should create them on signup; this backfills if trigger ran before migration)
INSERT INTO public.profiles (id, name, avatar_url, role, onboarding_complete, google_connected)
SELECT u.id,
  COALESCE(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', split_part(u.email, '@', 1), 'User'),
  u.raw_user_meta_data ->> 'avatar_url',
  'student',
  true,
  COALESCE((u.raw_user_meta_data ->> 'provider') = 'google', false)
FROM auth.users u
WHERE u.id IN (
  SELECT user_id FROM public.doubts
  UNION
  SELECT user_id FROM public.doubt_answers
)
ON CONFLICT (id) DO NOTHING;

-- 2. Insert mock academics for users who have profiles but no academics
INSERT INTO public.profile_academics (user_id, exam, board, score, verified)
SELECT p.id, 'Class 10', 'State Board', '94%', 'verified'
FROM public.profiles p
WHERE p.id IN (SELECT user_id FROM public.doubts UNION SELECT user_id FROM public.doubt_answers)
AND NOT EXISTS (SELECT 1 FROM public.profile_academics pa WHERE pa.user_id = p.id);

INSERT INTO public.profile_academics (user_id, exam, board, score, verified)
SELECT p.id, 'Class 12', 'State Board', '88%', 'verified'
FROM public.profiles p
WHERE p.id IN (SELECT user_id FROM public.doubts UNION SELECT user_id FROM public.doubt_answers)
AND (SELECT count(*) FROM public.profile_academics pa WHERE pa.user_id = p.id) = 1;

-- 3. Insert mock achievements for users who have profiles but no achievements
INSERT INTO public.profile_achievements (user_id, name, level, year, result)
SELECT p.id, 'Physics Olympiad', 'State', 2024, 'Bronze Medal'
FROM public.profiles p
WHERE p.id IN (SELECT user_id FROM public.doubts UNION SELECT user_id FROM public.doubt_answers)
AND NOT EXISTS (SELECT 1 FROM public.profile_achievements pa WHERE pa.user_id = p.id);

INSERT INTO public.profile_achievements (user_id, name, level, year, result)
SELECT p.id, 'Science Fair', 'School', 2023, 'Best Project'
FROM public.profiles p
WHERE p.id IN (SELECT user_id FROM public.doubts UNION SELECT user_id FROM public.doubt_answers)
AND (SELECT count(*) FROM public.profile_achievements pa WHERE pa.user_id = p.id) = 1;

INSERT INTO public.profile_achievements (user_id, name, level, year, result)
SELECT p.id, 'Mock Test Topper', 'District', 2025, 'Rank 1'
FROM public.profiles p
WHERE p.id IN (SELECT user_id FROM public.doubts UNION SELECT user_id FROM public.doubt_answers)
AND (SELECT count(*) FROM public.profile_achievements pa WHERE pa.user_id = p.id) = 2;
