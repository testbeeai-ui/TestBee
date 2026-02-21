-- Time-limited class exploration for non-members (e.g. 10 minutes). One row per user per classroom.
CREATE TABLE IF NOT EXISTS public.class_exploration_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  classroom_id uuid NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, classroom_id)
);

CREATE INDEX IF NOT EXISTS idx_class_exploration_sessions_user_id ON public.class_exploration_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_class_exploration_sessions_classroom_id ON public.class_exploration_sessions(classroom_id);

ALTER TABLE public.class_exploration_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own class_exploration_sessions" ON public.class_exploration_sessions;
CREATE POLICY "Users can read own class_exploration_sessions"
  ON public.class_exploration_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own class_exploration_session" ON public.class_exploration_sessions;
CREATE POLICY "Users can insert own class_exploration_session"
  ON public.class_exploration_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.class_exploration_sessions IS 'Tracks when a non-member started exploring a class; 10-minute window is enforced server-side.';
