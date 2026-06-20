-- Lightweight "active on site now" heartbeat for Learning Buddy (updated on any page focus / heartbeat).

CREATE TABLE IF NOT EXISTS public.student_site_presence (
  user_id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_site_presence_updated
  ON public.student_site_presence (updated_at DESC);

COMMENT ON TABLE public.student_site_presence IS
  'Latest site-wide focus heartbeat for Learning Buddy right-now display.';

ALTER TABLE public.student_site_presence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS student_site_presence_select_own ON public.student_site_presence;
CREATE POLICY student_site_presence_select_own
  ON public.student_site_presence FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS student_site_presence_select_active_buddy ON public.student_site_presence;
CREATE POLICY student_site_presence_select_active_buddy
  ON public.student_site_presence FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.study_buddies sb
      WHERE sb.user_id = auth.uid()
        AND sb.status = 'active'
        AND sb.buddy_user_id = student_site_presence.user_id
    )
  );

DROP POLICY IF EXISTS student_site_presence_insert_own ON public.student_site_presence;
CREATE POLICY student_site_presence_insert_own
  ON public.student_site_presence FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS student_site_presence_update_own ON public.student_site_presence;
CREATE POLICY student_site_presence_update_own
  ON public.student_site_presence FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.student_site_presence;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;
