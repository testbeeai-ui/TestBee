-- Add plan_tier column to profiles for enforcing plan-based save caps.
-- Default 'free' — updated when user subscribes to a plan.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan_tier text NOT NULL DEFAULT 'free';

COMMENT ON COLUMN public.profiles.plan_tier IS
  'Subscription plan tier: free (50 saves/type), scholar (500), champion (unlimited). Used for save cap enforcement.';
