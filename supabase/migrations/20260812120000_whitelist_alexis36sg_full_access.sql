-- Whitelist + admin for alexis36sg@gmail.com (idempotent).
-- 1) approved_emails — bypass waitlist gate on sign-in / before onboarding completes
-- 2) user_roles + profiles — full admin if auth.users row exists

INSERT INTO public.approved_emails (email, role, first_name, last_name, approved_via)
VALUES ('alexis36sg@gmail.com', 'student', 'Alexis', '', 'manual')
ON CONFLICT (email) DO UPDATE SET
  role = EXCLUDED.role,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  approved_via = EXCLUDED.approved_via;

DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(trim(email)) = lower(trim('alexis36sg@gmail.com'))
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'alexis36sg@gmail.com whitelisted; admin grant pending first sign-up.';
    RETURN;
  END IF;

  DELETE FROM public.user_roles
  WHERE user_id = v_user_id AND role = 'admin'::public.app_role;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'admin'::public.app_role);

  UPDATE public.profiles
  SET role = 'admin', updated_at = now()
  WHERE id = v_user_id;
END $$;
