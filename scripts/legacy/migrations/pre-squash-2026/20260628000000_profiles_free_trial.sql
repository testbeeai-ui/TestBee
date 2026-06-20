-- Supabase migration to support production-ready student free trial onboarding tracking
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS free_trial_activated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS free_trial_activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_onboarding_answers jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.profiles.free_trial_activated IS 'Tracks if the user has activated their 14-day free trial.';
COMMENT ON COLUMN public.profiles.free_trial_activated_at IS 'Timestamp when the free trial was activated.';
COMMENT ON COLUMN public.profiles.trial_onboarding_answers IS 'Persisted JSON answers from the student free trial onboarding questionnaire.';
