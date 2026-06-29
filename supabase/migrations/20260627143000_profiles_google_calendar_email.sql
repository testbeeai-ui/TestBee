-- Google account email used for Calendar OAuth (Meet host). Safe to show the teacher on their own profile.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS google_calendar_email text;

COMMENT ON COLUMN public.profiles.google_calendar_email IS
  'Email of the Google account connected for Calendar/Meet (primary calendar id). Used so teachers open Meet as host, not guest.';
