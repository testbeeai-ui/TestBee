-- Close privacy/security gaps from Learning Buddy Advanced and student event analytics.

-- Admin analytics RPCs are SECURITY DEFINER and read all student_events rows.
-- PostgreSQL grants EXECUTE on functions to PUBLIC by default, so make the
-- intended service_role-only contract explicit.
REVOKE ALL ON FUNCTION public.admin_event_funnel(text[], int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_event_summary(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_event_funnel(text[], int) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_event_summary(int) TO service_role;

-- Buddy viewers may only read live subtopic presence when the buddy shares subtopics.
DROP POLICY IF EXISTS student_learning_presence_select_active_buddy
  ON public.student_learning_presence;
CREATE POLICY student_learning_presence_select_active_buddy
  ON public.student_learning_presence FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.study_buddies sb
      JOIN public.profiles p ON p.id = student_learning_presence.user_id
      WHERE sb.user_id = auth.uid()
        AND sb.status = 'active'
        AND sb.buddy_user_id = student_learning_presence.user_id
        AND COALESCE(p.buddy_privacy_settings ->> 'share_subtopics', 'true') <> 'false'
    )
  );

DROP POLICY IF EXISTS student_learning_dwell_select_active_buddy
  ON public.student_learning_dwell_events;
CREATE POLICY student_learning_dwell_select_active_buddy
  ON public.student_learning_dwell_events FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.study_buddies sb
      JOIN public.profiles p ON p.id = student_learning_dwell_events.user_id
      WHERE sb.user_id = auth.uid()
        AND sb.status = 'active'
        AND sb.buddy_user_id = student_learning_dwell_events.user_id
        AND COALESCE(p.buddy_privacy_settings ->> 'share_subtopics', 'true') <> 'false'
    )
  );

-- Gyan browsing presence follows the Gyan++ sharing toggle.
DROP POLICY IF EXISTS student_gyan_presence_select_active_buddy
  ON public.student_gyan_presence;
CREATE POLICY student_gyan_presence_select_active_buddy
  ON public.student_gyan_presence FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.study_buddies sb
      JOIN public.profiles p ON p.id = student_gyan_presence.user_id
      WHERE sb.user_id = auth.uid()
        AND sb.status = 'active'
        AND sb.buddy_user_id = student_gyan_presence.user_id
        AND COALESCE(p.buddy_privacy_settings ->> 'share_gyan', 'true') <> 'false'
    )
  );

-- Site-wide online presence is login activity, covered by the streak/login toggle.
DROP POLICY IF EXISTS student_site_presence_select_active_buddy
  ON public.student_site_presence;
CREATE POLICY student_site_presence_select_active_buddy
  ON public.student_site_presence FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.study_buddies sb
      JOIN public.profiles p ON p.id = student_site_presence.user_id
      WHERE sb.user_id = auth.uid()
        AND sb.status = 'active'
        AND sb.buddy_user_id = student_site_presence.user_id
        AND COALESCE(p.buddy_privacy_settings ->> 'share_streak', 'true') <> 'false'
    )
  );
