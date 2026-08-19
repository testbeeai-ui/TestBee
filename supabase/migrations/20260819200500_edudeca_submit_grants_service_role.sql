-- Production landing submits must be writable by service_role.
-- Keep public waitlist insert; stop anon from reading/deleting EduDeca profile rows.

REVOKE ALL ON TABLE public.edudeca_profiles FROM anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.edudeca_profiles TO authenticated;
GRANT ALL ON TABLE public.edudeca_profiles TO service_role;

REVOKE ALL ON TABLE public.edudeca_interest_registrations FROM anon;
GRANT INSERT ON TABLE public.edudeca_interest_registrations TO anon, authenticated;
GRANT ALL ON TABLE public.edudeca_interest_registrations TO service_role;

DROP POLICY IF EXISTS "edudeca_profiles_service_role" ON public.edudeca_profiles;
CREATE POLICY "edudeca_profiles_service_role"
  ON public.edudeca_profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "edudeca_interest_service_role" ON public.edudeca_interest_registrations;
CREATE POLICY "edudeca_interest_service_role"
  ON public.edudeca_interest_registrations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
