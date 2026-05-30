-- Add INSERT policy for admins to enable `.upsert()` on rdm_config
DROP POLICY IF EXISTS rdm_config_insert_admin ON public.rdm_config;
CREATE POLICY rdm_config_insert_admin ON public.rdm_config
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );
