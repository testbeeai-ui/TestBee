-- Prevent authenticated users from self-assigning admin privileges through
-- client-writable role fields. Admin grants are made via service-role paths.

BEGIN;

DROP POLICY IF EXISTS "Users can insert own user_roles" ON public.user_roles;
CREATE POLICY "Users can insert own user_roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id
    AND role <> 'admin'::public.app_role
  );

DROP POLICY IF EXISTS "Users can update own user_roles" ON public.user_roles;
CREATE POLICY "Users can update own user_roles"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK (
    (select auth.uid()) = user_id
    AND role <> 'admin'::public.app_role
  );

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = (select auth.uid()))
  WITH CHECK (
    id = (select auth.uid())
    AND (
      lower(trim(coalesce(role, ''))) <> 'admin'
      OR EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = (select auth.uid())
          AND ur.role = 'admin'::public.app_role
      )
    )
  );

COMMIT;
