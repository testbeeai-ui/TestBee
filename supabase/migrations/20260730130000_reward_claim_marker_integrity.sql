-- Reward claim markers are payout integrity fields. The broad profiles UPDATE RLS policy lets
-- users edit their own profile JSON, so lock once-set claim timestamps against client resets.

CREATE OR REPLACE FUNCTION public.profiles_reward_claim_marker_mutation_allowed()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(NULLIF(current_setting('app.allow_profile_reward_claim_mutation', true), ''), '0') = '1';
$$;

CREATE OR REPLACE FUNCTION public.free_trial_daily_claim_markers_preserved(
  p_old jsonb,
  p_new jsonb
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM jsonb_each(COALESCE(p_old, '{}'::jsonb)) AS old_day(day_key, day_state)
    WHERE COALESCE(old_day.day_state ->> 'claimed_at', '') <> ''
      AND COALESCE(COALESCE(p_new, '{}'::jsonb) -> old_day.day_key ->> 'claimed_at', '')
        IS DISTINCT FROM COALESCE(old_day.day_state ->> 'claimed_at', '')
  );
$$;

CREATE OR REPLACE FUNCTION public.profiles_enforce_reward_claim_integrity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF public.profiles_reward_claim_marker_mutation_allowed() THEN
    RETURN NEW;
  END IF;

  IF OLD.onboarding_reward_claimed_at IS NOT NULL
     AND NEW.onboarding_reward_claimed_at IS DISTINCT FROM OLD.onboarding_reward_claimed_at THEN
    RAISE EXCEPTION 'Onboarding reward claim timestamp cannot be modified directly';
  END IF;

  IF OLD.free_trial_daily_streak IS DISTINCT FROM NEW.free_trial_daily_streak
     AND NOT public.free_trial_daily_claim_markers_preserved(
       OLD.free_trial_daily_streak,
       NEW.free_trial_daily_streak
     ) THEN
    RAISE EXCEPTION 'Daily streak reward claim timestamps cannot be modified directly';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_enforce_reward_claim_integrity_trigger ON public.profiles;
CREATE TRIGGER profiles_enforce_reward_claim_integrity_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_enforce_reward_claim_integrity();

COMMENT ON FUNCTION public.profiles_enforce_reward_claim_integrity() IS
  'Prevents client-writable profile updates from clearing reward claim markers and re-claiming RDM.';
