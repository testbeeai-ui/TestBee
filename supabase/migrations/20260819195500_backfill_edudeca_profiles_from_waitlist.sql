-- Copy waitlist registrations onto edudeca_profiles for emails that already have auth.users.
INSERT INTO public.edudeca_profiles (id, email, class_level, institution_name, state, city)
SELECT
  u.id,
  u.email,
  w.class_level,
  w.institution,
  w.state,
  w.city
FROM public.edudeca_interest_registrations w
JOIN auth.users u ON lower(u.email) = lower(w.email)
ON CONFLICT (id) DO UPDATE
SET
  email = COALESCE(EXCLUDED.email, public.edudeca_profiles.email),
  class_level = EXCLUDED.class_level,
  institution_name = EXCLUDED.institution_name,
  state = EXCLUDED.state,
  city = EXCLUDED.city;
