-- Migration: Add subscription_started_at to profiles
-- Tracks when a student upgraded to a paid plan (starter / pro).
-- Used to calculate time-based loyalty multiplier tier.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_started_at timestamptz;

COMMENT ON COLUMN public.profiles.subscription_started_at IS
  'Timestamp when the student first activated a paid subscription (starter or pro). '
  'Used to calculate loyalty month index for dynamic RDM multipliers: '
  'Starter M1-3 = 0.5x, M4+ = 1.0x | Pro M1-5 = 1.0x, M6-11 = 1.5x, M12+ = 2.0x';
