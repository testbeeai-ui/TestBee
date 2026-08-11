-- Ensure privilege-escalation guard is bound after baseline creates public.profiles.
-- Safe on prod (replaces existing trigger with the same function).

CREATE OR REPLACE FUNCTION public.profiles_prevent_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      IF current_setting('edublast.allow_profile_role_change', true) IS DISTINCT FROM 'on' THEN
        RAISE EXCEPTION 'profiles.role is not client-writable';
      END IF;
    END IF;
    IF NEW.rdm IS DISTINCT FROM OLD.rdm
       AND NOT public.profiles_rdm_mutation_allowed() THEN
      RAISE EXCEPTION 'profiles.rdm is not client-writable';
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    IF NEW.role IS NOT NULL AND NEW.role NOT IN ('student', 'learner') THEN
      IF current_setting('edublast.allow_profile_role_change', true) IS DISTINCT FROM 'on' THEN
        RAISE EXCEPTION 'profiles.role insert not allowed for this value';
      END IF;
    END IF;
    IF coalesce(NEW.rdm, 0) <> 0
       AND NOT public.profiles_rdm_mutation_allowed() THEN
      RAISE EXCEPTION 'profiles.rdm must start at 0';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_profiles_prevent_privilege_escalation ON public.profiles;
CREATE TRIGGER trg_profiles_prevent_privilege_escalation
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_prevent_privilege_escalation();
