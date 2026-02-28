-- Fix handle_new_user: provider is in raw_app_meta_data, not raw_user_meta_data.
-- (raw_user_meta_data ->> 'provider') returns NULL for Google OAuth users,
-- causing NULL in google_connected and profile creation to fail silently.
-- Use raw_app_meta_data and COALESCE so profile insert always succeeds.

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, avatar_url, role, onboarding_complete, google_connected)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      split_part(COALESCE(NEW.email, ''), '@', 1),
      'User'
    ),
    NEW.raw_user_meta_data ->> 'avatar_url',
    'student',
    false,
    COALESCE((NEW.raw_app_meta_data ->> 'provider') = 'google', false)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
