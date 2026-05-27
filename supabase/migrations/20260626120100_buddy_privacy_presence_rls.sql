-- Honor Learning Buddy privacy toggles for direct client/Realtimes reads too.
-- API routes use the service role and apply their own response masking.

DROP POLICY IF EXISTS student_learning_presence_select_active_buddy ON public.student_learning_presence;
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
        AND COALESCE((p.buddy_privacy_settings ->> 'share_subtopics')::boolean, true)
    )
  );

DROP POLICY IF EXISTS student_learning_dwell_select_active_buddy ON public.student_learning_dwell_events;
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
        AND COALESCE((p.buddy_privacy_settings ->> 'share_subtopics')::boolean, true)
    )
  );

DROP POLICY IF EXISTS student_gyan_presence_select_active_buddy ON public.student_gyan_presence;
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
        AND COALESCE((p.buddy_privacy_settings ->> 'share_gyan')::boolean, true)
    )
  );

DROP POLICY IF EXISTS student_site_presence_select_active_buddy ON public.student_site_presence;
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
        AND COALESCE((p.buddy_privacy_settings ->> 'share_streak')::boolean, true)
    )
  );
