-- Separate Supabase "Sign in with Google" from Google Calendar OAuth (Meet / scheduling).
-- profiles.google_connected := Calendar OAuth completed (refresh token in teacher_google_calendar_tokens).
-- profiles.signup_google := original auth provider was Google (informational).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS signup_google boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.google_connected IS
  'True after explicit Google Calendar OAuth (refresh token stored in teacher_google_calendar_tokens). Not the same as signing in with Google.';
COMMENT ON COLUMN public.profiles.signup_google IS
  'True when the user originally authenticated via Google (Supabase auth provider).';

UPDATE public.profiles AS p
SET signup_google = true
FROM auth.users AS u
WHERE u.id = p.id
  AND COALESCE(u.raw_app_meta_data ->> 'provider', '') = 'google';

UPDATE public.profiles AS p
SET google_connected = EXISTS (
  SELECT 1
  FROM public.teacher_google_calendar_tokens AS t
  WHERE t.user_id = p.id
    AND length(btrim(COALESCE(t.refresh_token, ''))) > 0
);

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    name,
    avatar_url,
    role,
    onboarding_complete,
    google_connected,
    signup_google
  )
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
