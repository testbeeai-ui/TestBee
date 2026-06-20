-- Migration to update study streak bonus configuration to 90 days / 500 RDM.
-- Delete obsolete week number configuration key
DELETE FROM public.rdm_config WHERE key = 'study_streak_bonus_week_number';

-- Insert new study_streak_bonus_days configuration key
INSERT INTO public.rdm_config (key, value, description)
VALUES (
  'study_streak_bonus_days',
  90,
  'Dashboard · Study streak bonus days label (UI copy only; no payout)'
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Update study_streak_bonus_rdm to default to 500
INSERT INTO public.rdm_config (key, value, description)
VALUES (
  'study_streak_bonus_rdm',
  500,
  'Dashboard · Study streak bonus amount label in RDM (UI copy only; no payout)'
)
ON CONFLICT (key) DO UPDATE SET value = 500;
