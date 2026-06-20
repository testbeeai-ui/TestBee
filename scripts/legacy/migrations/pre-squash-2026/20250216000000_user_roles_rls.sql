-- Allow authenticated users to insert/update their own row in user_roles.
-- Fixes: "new row violates row-level security policy for table user_roles"
-- Run this in Supabase Dashboard → SQL Editor, or via: supabase db push

ALTER TABLE IF EXISTS public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own user_roles" ON public.user_roles;
CREATE POLICY "Users can insert own user_roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own user_roles" ON public.user_roles;
CREATE POLICY "Users can update own user_roles"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own user_roles" ON public.user_roles;
CREATE POLICY "Users can read own user_roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
