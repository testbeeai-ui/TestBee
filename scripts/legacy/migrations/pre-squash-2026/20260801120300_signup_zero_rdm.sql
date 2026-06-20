-- New signups start with 0 RDM. Free-trial welcome bonus is credited only on activate-trial (add_rdm).

ALTER TABLE public.profiles
  ALTER COLUMN rdm SET DEFAULT 0;

COMMENT ON COLUMN public.profiles.rdm IS
  'User RDM balance. New accounts default to 0; free_trial_welcome_rdm is credited on trial activation via add_rdm.';

CREATE OR REPLACE FUNCTION public.profiles_enforce_rdm_integrity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_default_rdm integer := 0;
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

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  default_class_id uuid;
BEGIN
  INSERT INTO public.profiles (
    id,
    name,
    avatar_url,
    role,
    onboarding_complete,
    google_connected,
    rdm
  )
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      split_part(COALESCE(NEW.email, ''), '@', 1),
      'User'
    ),
    NEW.raw_user_meta_data ->> 'avatar_url',
    'student',
    false,
    COALESCE((NEW.raw_app_meta_data ->> 'provider') = 'google', false),
    0
  )
  ON CONFLICT (id) DO NOTHING;

  SELECT id INTO default_class_id FROM public.classrooms WHERE name = 'Class' LIMIT 1;
  IF default_class_id IS NOT NULL THEN
    INSERT INTO public.classroom_members (classroom_id, user_id, role)
    VALUES (default_class_id, NEW.id, 'student')
    ON CONFLICT (classroom_id, user_id) DO NOTHING;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$;
