-- Run in Supabase Dashboard → SQL Editor (project: TestBee / bytsiknhtcnlxwzgqkrd)
-- Grants admin to mailidpwd@gmail.com. User must have signed up at least once.

DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(trim(email)) = lower(trim('mailidpwd@gmail.com'))
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No account for mailidpwd@gmail.com — sign up in the app first, then run this again.';
  END IF;

  DELETE FROM public.user_roles
  WHERE user_id = v_user_id AND role = 'admin'::public.app_role;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'admin'::public.app_role);

  UPDATE public.profiles
  SET role = 'admin', updated_at = now()
  WHERE id = v_user_id;

  RAISE NOTICE 'Admin granted for user_id %', v_user_id;
END $$;
