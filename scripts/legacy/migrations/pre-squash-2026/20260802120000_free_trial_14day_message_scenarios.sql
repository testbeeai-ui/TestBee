-- Migration: Add fields to support 14-day free trial scenarios and payment details
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_second_round_activated boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_card_details jsonb DEFAULT null,
  ADD COLUMN IF NOT EXISTS card_added_at timestamptz DEFAULT null,
  ADD COLUMN IF NOT EXISTS trial_end_bonus_activated boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS trial_streak_at_day_14 integer DEFAULT null,
  ADD COLUMN IF NOT EXISTS trial_original_ended_at timestamptz DEFAULT null;

COMMENT ON COLUMN public.profiles.trial_second_round_activated IS 'Tracks if the student activated the additional 2-week free trial.';
COMMENT ON COLUMN public.profiles.payment_card_details IS 'Stores dummy card details and the selected plan.';
COMMENT ON COLUMN public.profiles.card_added_at IS 'Tracks when card details were saved (used to check the 24-hour bonus window).';
COMMENT ON COLUMN public.profiles.trial_end_bonus_activated IS 'Tracks if the student claimed the 1-month free bonus.';
COMMENT ON COLUMN public.profiles.trial_streak_at_day_14 IS 'Stores their streak count when the 14-day trial completed.';
COMMENT ON COLUMN public.profiles.trial_original_ended_at IS 'Tracks when the initial 14-day trial officially expired.';
