-- Grant admin role to michaelkillgta@gmail.com (idempotent).
-- Note: user must exist in auth.users (i.e., have signed up) for this to take effect.

DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'michaelkillgta@gmail.com'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'No auth.users row found for michaelkillgta@gmail.com. Ask user to sign up first, then re-run migrations.';
    RETURN;
  END IF;

  -- user_roles has no UNIQUE constraint on user_id, so we make this idempotent via delete + insert.
  DELETE FROM public.user_roles WHERE user_id = v_user_id;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'admin'::public.app_role);
END $$;

