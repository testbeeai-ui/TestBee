-- SECURITY DEFINER on enforce_verified triggers stripped JWT context, so service_role
-- updates from the admin API looked like anonymous DB sessions → false "not admin" errors.
-- Re-create as SECURITY INVOKER and detect role via auth.jwt() (Supabase-standard).

CREATE OR REPLACE FUNCTION public.profile_achievements_enforce_verified()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  jwt_role text;
BEGIN
  jwt_role := coalesce(
    nullif(auth.jwt() ->> 'role', ''),
    nullif((SELECT auth.role())::text, ''),
    nullif(trim(coalesce(current_setting('request.jwt.claim.role', true), '')), '')
  );

  IF coalesce(NEW.verified, '') <> 'verified' THEN
    RETURN NEW;
  END IF;

  IF jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND coalesce(OLD.verified, '') = 'verified' AND NEW.verified = 'verified' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Only administrators can mark achievements as verified'
    USING ERRCODE = 'check_violation';
END;
$$;

CREATE OR REPLACE FUNCTION public.profile_academics_enforce_verified()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  jwt_role text;
BEGIN
  jwt_role := coalesce(
    nullif(auth.jwt() ->> 'role', ''),
    nullif((SELECT auth.role())::text, ''),
    nullif(trim(coalesce(current_setting('request.jwt.claim.role', true), '')), '')
  );

  IF coalesce(NEW.verified, '') <> 'verified' THEN
    RETURN NEW;
  END IF;

  IF jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND coalesce(OLD.verified, '') = 'verified' AND NEW.verified = 'verified' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Only administrators can mark academic records as verified'
    USING ERRCODE = 'check_violation';
END;
$$;
