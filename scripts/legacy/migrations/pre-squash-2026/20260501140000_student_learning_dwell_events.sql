-- Phase 2: coarse dwell-time samples on subtopic topic pages (heartbeats while tab visible).
-- Admin aggregates by scope + panel; not a forensic audit log.

CREATE TABLE IF NOT EXISTS public.student_learning_dwell_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  board text NOT NULL CHECK (board IN ('CBSE', 'ICSE')),
  subject text NOT NULL CHECK (subject IN ('physics', 'chemistry', 'math')),
  class_level integer NOT NULL CHECK (class_level IN (11, 12)),
  topic text NOT NULL,
  subtopic_name text NOT NULL,
  level text NOT NULL CHECK (level IN ('basics', 'intermediate', 'advanced')),
  panel text NOT NULL CHECK (panel IN ('theory', 'bits', 'numerals', 'instacue')),
  delta_ms integer NOT NULL CHECK (delta_ms > 0 AND delta_ms <= 3600000),
  bits_question_index integer NULL,
  client_session_id text NULL
);

CREATE INDEX IF NOT EXISTS idx_student_learning_dwell_user_occurred
  ON public.student_learning_dwell_events (user_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_student_learning_dwell_user_scope
  ON public.student_learning_dwell_events (user_id, board, subject, class_level, topic, subtopic_name, level);

COMMENT ON TABLE public.student_learning_dwell_events IS
  'Heartbeat-derived active dwell samples per subtopic panel (theory/bits/numerals/instacue).';

ALTER TABLE public.student_learning_dwell_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS student_learning_dwell_select_own ON public.student_learning_dwell_events;
CREATE POLICY student_learning_dwell_select_own
  ON public.student_learning_dwell_events FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS student_learning_dwell_insert_own ON public.student_learning_dwell_events;
CREATE POLICY student_learning_dwell_insert_own
  ON public.student_learning_dwell_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
