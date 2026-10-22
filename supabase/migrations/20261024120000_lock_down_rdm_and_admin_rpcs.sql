-- These SECURITY DEFINER functions take a user id (or none) from the caller and
-- never check auth.uid(), yet anon and authenticated could EXECUTE them through
-- PostgREST with the publishable key: anyone could mint or drain RDM for any
-- user, run admin analytics, or claim referrals and buddy pairs for others.
-- Web only calls them with the service-role client, and every in-database caller
-- is itself SECURITY DEFINER, so revoking client access does not break callers.

DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.add_rdm(uuid, integer)',
    'public.deduct_rdm(uuid, integer)',
    'public.award_daily_rdm(uuid, text, integer)',
    'public.admin_analytics_summary()',
    'public.admin_churn_risk(integer)',
    'public.admin_conversion_funnel()',
    'public.admin_dropoff_tracking()',
    'public.admin_event_funnel(text[], integer)',
    'public.admin_event_summary(integer)',
    'public.admin_feature_adoption()',
    'public.admin_retention_cohorts()',
    'public.award_classroom_batch_paid_bonus(uuid)',
    'public.award_eligible_section_schedule_delivery_rdm(uuid)',
    'public.award_eligible_teacher_live_class_delivery_rdm(uuid)',
    'public.award_eligible_teacher_live_class_quality_rdm(uuid)',
    'public.award_teacher_live_class_delivery_rdm(uuid, text, boolean)',
    'public.award_teacher_referral_paid_bonus(uuid)',
    'public.award_teacher_section_schedule_occurrence_rdm(uuid, timestamp with time zone, text, boolean)',
    'public.award_teacher_section_schedule_quality_rdm(uuid, timestamp with time zone)',
    'public.claim_referral_attribution(text, uuid)',
    'public.accept_buddy_invite(text, uuid)',
    'public.accept_buddy_invite(text, uuid, integer, integer)',
    'public.end_buddy_pair(uuid)',
    'public.end_buddy_pair(uuid, uuid)',
    'public.refund_expired_doubt_bounties()',
    'public.resolve_subscription_plan_key(uuid)',
    'public.get_user_saved_item_counts(uuid)',
    'public._student_bits_attempt(uuid, text)'
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END;
$$;

-- "Users can update own profile" lets a signed-in user write any column on
-- their row. Teacher plan dates/tier and lifetime_answer_rdm are only ever set
-- by the service-role client or SECURITY DEFINER functions, so block direct
-- client writes. Not SECURITY DEFINER: current_user must be the caller's role.
CREATE OR REPLACE FUNCTION public.profiles_guard_server_only_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.teacher_plan_tier IS DISTINCT FROM OLD.teacher_plan_tier
       OR NEW.teacher_plan_started_at IS DISTINCT FROM OLD.teacher_plan_started_at
       OR NEW.teacher_plan_expires_at IS DISTINCT FROM OLD.teacher_plan_expires_at
       OR NEW.lifetime_answer_rdm IS DISTINCT FROM OLD.lifetime_answer_rdm THEN
      RAISE EXCEPTION 'profiles teacher plan and lifetime_answer_rdm are not client-writable';
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    NEW.teacher_plan_tier := 'free';
    NEW.teacher_plan_started_at := NULL;
    NEW.teacher_plan_expires_at := NULL;
    NEW.lifetime_answer_rdm := 0;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard_server_only_columns_trg ON public.profiles;
CREATE TRIGGER profiles_guard_server_only_columns_trg
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_guard_server_only_columns();
