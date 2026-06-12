-- Phase 5: monthly range partitions on student_learning_dwell_events (scale prep).

BEGIN;

ALTER TABLE public.student_learning_dwell_events RENAME TO student_learning_dwell_events_legacy;

CREATE TABLE public.student_learning_dwell_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
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
  client_session_id text NULL,
  PRIMARY KEY (id, occurred_at)
) PARTITION BY RANGE (occurred_at);

DO $$
DECLARE
  m date := date '2024-01-01';
  part_name text;
  m_end date;
BEGIN
  WHILE m < date '2029-01-01' LOOP
    m_end := (m + interval '1 month')::date;
    part_name := format('student_learning_dwell_%s', to_char(m, 'YYYY_MM'));
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.student_learning_dwell_events FOR VALUES FROM (%L) TO (%L)',
      part_name,
      m,
      m_end
    );
    m := m_end;
  END LOOP;
END $$;

INSERT INTO public.student_learning_dwell_events
SELECT * FROM public.student_learning_dwell_events_legacy;

DROP TABLE public.student_learning_dwell_events_legacy;

CREATE INDEX IF NOT EXISTS idx_student_learning_dwell_user_occurred
  ON public.student_learning_dwell_events (user_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_student_learning_dwell_user_scope
  ON public.student_learning_dwell_events (user_id, board, subject, class_level, topic, subtopic_name, level);

COMMENT ON TABLE public.student_learning_dwell_events IS
  'Heartbeat-derived active dwell samples per subtopic panel (monthly partitions).';

ALTER TABLE public.student_learning_dwell_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS student_learning_dwell_select_own ON public.student_learning_dwell_events;
CREATE POLICY student_learning_dwell_select_own
  ON public.student_learning_dwell_events FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS student_learning_dwell_insert_own ON public.student_learning_dwell_events;
CREATE POLICY student_learning_dwell_insert_own
  ON public.student_learning_dwell_events FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS student_learning_dwell_select_active_buddy ON public.student_learning_dwell_events;
CREATE POLICY student_learning_dwell_select_active_buddy
  ON public.student_learning_dwell_events FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.study_buddies sb
      WHERE sb.user_id = (select auth.uid())
        AND sb.status = 'active'
        AND sb.buddy_user_id = student_learning_dwell_events.user_id
    )
  );

-- Create next month's partition if missing (call from cron or migration runner).
CREATE OR REPLACE FUNCTION public.ensure_dwell_events_partition(p_month date DEFAULT date_trunc('month', now())::date)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  part_name text;
  m_start date;
  m_end date;
BEGIN
  m_start := date_trunc('month', p_month)::date;
  m_end := (m_start + interval '1 month')::date;
  part_name := format('student_learning_dwell_%s', to_char(m_start, 'YYYY_MM'));
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.student_learning_dwell_events FOR VALUES FROM (%L) TO (%L)',
    part_name,
    m_start,
    m_end
  );
  RETURN part_name;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_dwell_events_partition(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_dwell_events_partition(date) TO service_role;

COMMIT;
