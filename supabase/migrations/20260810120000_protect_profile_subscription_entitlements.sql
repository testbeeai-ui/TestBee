-- Prevent authenticated clients from self-minting subscription/trial entitlements
-- through the broad "Users can update own profile" RLS policy. Trusted server
-- APIs use the service role for these state transitions.

CREATE OR REPLACE FUNCTION public.profiles_enforce_rdm_integrity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_default_rdm integer := 0;
  v_is_trusted_subscription_writer boolean := current_user IN ('postgres', 'service_role', 'supabase_admin');
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT public.profiles_rdm_mutation_allowed() THEN
      IF NOT public.is_gyan_bot_user(NEW.id) AND NEW.rdm IS DISTINCT FROM v_default_rdm THEN
        NEW.rdm := v_default_rdm;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.rdm IS DISTINCT FROM NEW.rdm
       AND NOT public.profiles_rdm_mutation_allowed()
       AND NOT public.is_gyan_bot_user(NEW.id) THEN
      RAISE EXCEPTION 'RDM balance cannot be modified directly';
    END IF;

    IF NOT v_is_trusted_subscription_writer THEN
      IF OLD.plan_tier IS DISTINCT FROM NEW.plan_tier
         AND lower(coalesce(NEW.plan_tier, '')) IN ('free_trial', 'starter', 'scholar', 'pro', 'champion', 'pro_plus') THEN
        RAISE EXCEPTION 'Subscription plan cannot be activated directly';
      END IF;

      IF coalesce(OLD.free_trial_activated, false) IS DISTINCT FROM coalesce(NEW.free_trial_activated, false)
         AND coalesce(NEW.free_trial_activated, false) THEN
        RAISE EXCEPTION 'Free trial cannot be activated directly';
      END IF;

      IF OLD.free_trial_activated_at IS DISTINCT FROM NEW.free_trial_activated_at
         AND NEW.free_trial_activated_at IS NOT NULL THEN
        RAISE EXCEPTION 'Free trial timestamp cannot be set directly';
      END IF;

      IF coalesce(OLD.trial_second_round_activated, false) IS DISTINCT FROM coalesce(NEW.trial_second_round_activated, false)
         AND coalesce(NEW.trial_second_round_activated, false) THEN
        RAISE EXCEPTION 'Trial extension cannot be activated directly';
      END IF;

      IF coalesce(OLD.trial_end_bonus_activated, false) IS DISTINCT FROM coalesce(NEW.trial_end_bonus_activated, false)
         AND coalesce(NEW.trial_end_bonus_activated, false) THEN
        RAISE EXCEPTION 'Trial bonus cannot be activated directly';
      END IF;

      IF OLD.trial_original_ended_at IS DISTINCT FROM NEW.trial_original_ended_at THEN
        RAISE EXCEPTION 'Trial transition timestamp cannot be modified directly';
      END IF;

      IF OLD.card_added_at IS DISTINCT FROM NEW.card_added_at
         AND NEW.card_added_at IS NOT NULL THEN
        RAISE EXCEPTION 'Payment card timestamp cannot be set directly';
      END IF;

      IF OLD.subscription_started_at IS DISTINCT FROM NEW.subscription_started_at
         AND NEW.subscription_started_at IS NOT NULL THEN
        RAISE EXCEPTION 'Subscription start cannot be set directly';
      END IF;

      IF OLD.subscription_expires_at IS DISTINCT FROM NEW.subscription_expires_at
         AND NEW.subscription_expires_at IS NOT NULL THEN
        RAISE EXCEPTION 'Subscription expiry cannot be set directly';
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;
