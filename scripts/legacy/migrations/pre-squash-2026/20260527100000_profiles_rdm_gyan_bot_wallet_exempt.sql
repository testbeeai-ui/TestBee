-- After profiles_rdm_wallet_integrity: allow fixed Gyan++ bot rows to set profiles.rdm without
-- the session GUC (admin seed-gyan-bot-personas uses service role + direct upsert).
-- UUID list must stay in sync with lib/gyanBotPersonas.ts + public.is_gyan_bot_user().

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
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.rdm IS DISTINCT FROM NEW.rdm
       AND NOT public.profiles_rdm_mutation_allowed()
       AND NOT public.is_gyan_bot_user(NEW.id) THEN
      RAISE EXCEPTION 'RDM balance cannot be modified directly';
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;
