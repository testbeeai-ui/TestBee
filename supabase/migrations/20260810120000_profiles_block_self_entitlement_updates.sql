-- Prevent authenticated clients from self-granting admin or subscription entitlements.
-- Broad own-row profile updates are still needed for onboarding/profile fields, but
-- privileged fields must be changed by trusted server/admin flows using service_role.

CREATE OR REPLACE FUNCTION public.profiles_block_self_entitlement_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(auth.role(), '') <> 'authenticated' THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL OR OLD.id IS DISTINCT FROM auth.uid() THEN
    RETURN NEW;
  END IF;

  IF NEW.plan_tier IS DISTINCT FROM OLD.plan_tier
    OR NEW.free_trial_activated IS DISTINCT FROM OLD.free_trial_activated
    OR NEW.free_trial_activated_at IS DISTINCT FROM OLD.free_trial_activated_at
    OR NEW.subscription_started_at IS DISTINCT FROM OLD.subscription_started_at
    OR NEW.subscription_expires_at IS DISTINCT FROM OLD.subscription_expires_at
    OR NEW.trial_second_round_activated IS DISTINCT FROM OLD.trial_second_round_activated
    OR NEW.trial_end_bonus_activated IS DISTINCT FROM OLD.trial_end_bonus_activated
    OR NEW.trial_original_ended_at IS DISTINCT FROM OLD.trial_original_ended_at
    OR (
      NEW.role IS DISTINCT FROM OLD.role
      AND (LOWER(COALESCE(NEW.role, '')) = 'admin' OR LOWER(COALESCE(OLD.role, '')) = 'admin')
    )
  THEN
    RAISE EXCEPTION 'Privileged profile fields can only be updated by trusted server flows'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_block_self_entitlement_updates_trigger ON public.profiles;
CREATE TRIGGER profiles_block_self_entitlement_updates_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_block_self_entitlement_updates();

COMMENT ON FUNCTION public.profiles_block_self_entitlement_updates() IS
  'Blocks authenticated self-updates to admin/subscription entitlement columns; service_role server flows remain allowed.';
