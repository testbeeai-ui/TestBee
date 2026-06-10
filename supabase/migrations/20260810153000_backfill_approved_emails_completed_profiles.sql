-- Preserve access for existing users before the preview whitelist gate becomes strict.
-- New users must be present in approved_emails; onboarding_complete is no longer an access grant.
INSERT INTO public.approved_emails (
  email,
  role,
  first_name,
  last_name,
  approved_via
)
SELECT
  lower(u.email) AS email,
  p.role,
  nullif(trim(coalesce(p.first_name, split_part(p.name, ' ', 1), 'there')), '') AS first_name,
  nullif(trim(coalesce(p.last_name, '')), '') AS last_name,
  'manual' AS approved_via
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.onboarding_complete = true
  AND p.role IN ('student', 'teacher')
  AND u.email IS NOT NULL
  AND trim(u.email) <> ''
ON CONFLICT (email) DO NOTHING;
