-- Phase 3: allow authenticated users to clear their own presence rows (site-presence API without service role).

DROP POLICY IF EXISTS student_site_presence_delete_own ON public.student_site_presence;
CREATE POLICY student_site_presence_delete_own
  ON public.student_site_presence FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS student_learning_presence_delete_own ON public.student_learning_presence;
CREATE POLICY student_learning_presence_delete_own
  ON public.student_learning_presence FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS student_gyan_presence_delete_own ON public.student_gyan_presence;
CREATE POLICY student_gyan_presence_delete_own
  ON public.student_gyan_presence FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);
