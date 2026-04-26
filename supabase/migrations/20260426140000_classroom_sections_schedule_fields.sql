-- Persist section schedule fields for teacher UI labels.
-- Google Calendar remains source of truth for sync, but UI needs a stable label.

BEGIN;

ALTER TABLE public.classroom_sections
  ADD COLUMN IF NOT EXISTS schedule_date text,
  ADD COLUMN IF NOT EXISTS schedule_time text,
  ADD COLUMN IF NOT EXISTS duration_minutes integer,
  ADD COLUMN IF NOT EXISTS repeat_days text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS schedule_end_date text;

COMMIT;

