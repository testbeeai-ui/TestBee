-- Server-side Google Calendar OAuth tokens (read/write only via service role in API routes).
CREATE TABLE IF NOT EXISTS public.teacher_google_calendar_tokens (
  user_id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  refresh_token text NOT NULL,
  access_token text,
  access_token_expires_at timestamptz,
  scope text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.teacher_google_calendar_tokens IS 'Google OAuth refresh tokens for Calendar API; never expose to client.';

ALTER TABLE public.teacher_google_calendar_tokens ENABLE ROW LEVEL SECURITY;

-- Per-class Google Calendar recurring series + Meet (written by server after classroom create).
ALTER TABLE public.classrooms
  ADD COLUMN IF NOT EXISTS google_calendar_list_id text DEFAULT 'primary',
  ADD COLUMN IF NOT EXISTS google_recurring_event_id text,
  ADD COLUMN IF NOT EXISTS google_meet_link text,
  ADD COLUMN IF NOT EXISTS google_rrule text,
  ADD COLUMN IF NOT EXISTS google_time_zone text,
  ADD COLUMN IF NOT EXISTS google_recurrence_end_date date;

COMMENT ON COLUMN public.classrooms.google_calendar_list_id IS 'Calendar id (usually primary) where the series lives.';
COMMENT ON COLUMN public.classrooms.google_recurring_event_id IS 'Google Calendar event id for the recurring master.';
COMMENT ON COLUMN public.classrooms.google_meet_link IS 'Hangouts Meet join URL from conferenceData.';
COMMENT ON COLUMN public.classrooms.google_rrule IS 'RFC5545 RRULE sent to Google (debug/display).';
COMMENT ON COLUMN public.classrooms.google_time_zone IS 'IANA timezone used for the series.';
COMMENT ON COLUMN public.classrooms.google_recurrence_end_date IS 'Optional last calendar day of recurrence (matches teacher end-date UI).';
