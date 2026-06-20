-- Academic record hub: year per row, in-progress flag for Class XII, optional extras on profile.

ALTER TABLE public.profile_academics
  ADD COLUMN IF NOT EXISTS academic_year text,
  ADD COLUMN IF NOT EXISTS record_status text NOT NULL DEFAULT 'complete';

ALTER TABLE public.profile_academics DROP CONSTRAINT IF EXISTS profile_academics_record_status_check;
ALTER TABLE public.profile_academics
  ADD CONSTRAINT profile_academics_record_status_check
  CHECK (record_status IN ('complete', 'in_progress'));

COMMENT ON COLUMN public.profile_academics.academic_year IS 'Calendar or academic year (e.g. 2024).';
COMMENT ON COLUMN public.profile_academics.record_status IS 'complete = final marks; in_progress = e.g. Class XII ongoing.';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS academic_record_extras jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.profiles.academic_record_extras IS 'Optional subject-wise Class X marks and coaching; JSON shape defined by app.';
