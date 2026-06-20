-- Per-calendar-day checklist helpers (Instacue session ack, Gyan++ focus ms on /doubts).
-- Keyed by YYYY-MM-DD in the client’s local calendar (same string used for user_study_day_totals.day).
-- Shape example: { "2026-04-18": { "instacueSessionAck": true, "doubtsFocusMs": 320000 } }

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS daily_checklist_state jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.profiles.daily_checklist_state IS
  'JSON map dateKey (YYYY-MM-DD) -> { instacueSessionAck?: bool, doubtsFocusMs?: number } for dashboard daily checklist.';
