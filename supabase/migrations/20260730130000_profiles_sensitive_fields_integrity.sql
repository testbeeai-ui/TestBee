-- Protect subscription, reward-claim, and privileged trial fields from direct browser writes.
-- RLS intentionally allows users to update their own profile row for normal onboarding fields;
-- these columns drive paid limits / wallet claims and must only change through trusted server flows.

CREATE OR REPLACE FUNCTION public.profiles_sensitive_mutation_allowed()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    COALESCE(NULLIF(current_setting('app.allow_profile_sensitive_mutation', true), ''), '0') = '1'
    OR auth.role() = 'service_role'
    OR current_user IN ('postgres', 'supabase_admin', 'service_role');
$$;

CREATE OR REPLACE FUNCTION public.profiles_enforce_rdm_integrity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_default_rdm integer := 100;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT public.profiles_rdm_mutation_allowed() THEN
      IF NOT public.is_gyan_bot_user(NEW.id) AND NEW.rdm IS DISTINCT FROM v_default_rdm THEN
        NEW.rdm := v_default_rdm;
      END IF;
    END IF;

    IF NOT public.profiles_sensitive_mutation_allowed() THEN
      NEW.plan_tier := 'free';
      NEW.free_trial_activated := false;
      NEW.free_trial_activated_at := NULL;
      NEW.onboarding_reward_progress := '{}'::jsonb;
      NEW.onboarding_reward_claimed_at := NULL;
      NEW.free_trial_daily_streak := '{}'::jsonb;
      NEW.time_travel_enabled := false;
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.rdm IS DISTINCT FROM NEW.rdm
       AND NOT public.profiles_rdm_mutation_allowed()
       AND NOT public.is_gyan_bot_user(NEW.id) THEN
      RAISE EXCEPTION 'RDM balance cannot be modified directly';
    END IF;

    IF NOT public.profiles_sensitive_mutation_allowed()
       AND (
         OLD.plan_tier IS DISTINCT FROM NEW.plan_tier
         OR OLD.free_trial_activated IS DISTINCT FROM NEW.free_trial_activated
         OR OLD.free_trial_activated_at IS DISTINCT FROM NEW.free_trial_activated_at
         OR OLD.onboarding_reward_progress IS DISTINCT FROM NEW.onboarding_reward_progress
         OR OLD.onboarding_reward_claimed_at IS DISTINCT FROM NEW.onboarding_reward_claimed_at
         OR OLD.free_trial_daily_streak IS DISTINCT FROM NEW.free_trial_daily_streak
         OR OLD.time_travel_enabled IS DISTINCT FROM NEW.time_travel_enabled
       ) THEN
      RAISE EXCEPTION 'Protected profile subscription/reward fields cannot be modified directly';
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.profiles_sensitive_mutation_allowed() IS
  'True only for trusted server/profile maintenance flows that may mutate subscription and reward-state columns.';
