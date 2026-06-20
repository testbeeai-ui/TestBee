-- Live "what subtopic is this user on?" for Learning Buddy (updated on each subtopic open / heartbeat).
-- Dwell events remain for analytics; presence is the buddy-facing source of truth.

CREATE TABLE IF NOT EXISTS public.student_learning_presence (
  user_id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  board text NOT NULL CHECK (board IN ('CBSE', 'ICSE')),
  subject text NOT NULL CHECK (subject IN ('physics', 'chemistry', 'math')),
  class_level integer NOT NULL CHECK (class_level IN (11, 12)),
  topic text NOT NULL,
  subtopic_name text NOT NULL,
  level text NOT NULL CHECK (level IN ('basics', 'intermediate', 'advanced')),
  panel text NOT NULL CHECK (panel IN ('theory', 'bits', 'numerals', 'instacue')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_learning_presence_updated
  ON public.student_learning_presence (updated_at DESC);

COMMENT ON TABLE public.student_learning_presence IS
  'Latest subtopic panel per student for Learning Buddy right-now display.';

ALTER TABLE public.student_learning_presence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS student_learning_presence_select_own ON public.student_learning_presence;
CREATE POLICY student_learning_presence_select_own
  ON public.student_learning_presence FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS student_learning_presence_select_active_buddy ON public.student_learning_presence;
CREATE POLICY student_learning_presence_select_active_buddy
  ON public.student_learning_presence FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.study_buddies sb
      WHERE sb.user_id = auth.uid()
        AND sb.status = 'active'
        AND sb.buddy_user_id = student_learning_presence.user_id
    )
  );

DROP POLICY IF EXISTS student_learning_presence_insert_own ON public.student_learning_presence;
CREATE POLICY student_learning_presence_insert_own
  ON public.student_learning_presence FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS student_learning_presence_update_own ON public.student_learning_presence;
CREATE POLICY student_learning_presence_update_own
  ON public.student_learning_presence FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Buddies may read dwell history for paired users (dashboard fallback / admin-free dev).
DROP POLICY IF EXISTS student_learning_dwell_select_active_buddy ON public.student_learning_dwell_events;
CREATE POLICY student_learning_dwell_select_active_buddy
  ON public.student_learning_dwell_events FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.study_buddies sb
      WHERE sb.user_id = auth.uid()
        AND sb.status = 'active'
        AND sb.buddy_user_id = student_learning_dwell_events.user_id
    )
  );
