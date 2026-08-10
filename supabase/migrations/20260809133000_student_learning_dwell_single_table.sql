-- Collapse partitioned student_learning_dwell_events into one physical table:
-- public.student_learning_dwell (no monthly child tables in the Table Editor).

CREATE TABLE IF NOT EXISTS public.student_learning_dwell (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  board text NOT NULL CHECK (board = ANY (ARRAY['CBSE'::text, 'ICSE'::text])),
  subject text NOT NULL CHECK (subject = ANY (ARRAY['physics'::text, 'chemistry'::text, 'math'::text])),
  class_level integer NOT NULL CHECK (class_level = ANY (ARRAY[11, 12])),
  topic text NOT NULL,
  subtopic_name text NOT NULL,
  level text NOT NULL CHECK (level = ANY (ARRAY['basics'::text, 'intermediate'::text, 'advanced'::text])),
  panel text NOT NULL CHECK (panel = ANY (ARRAY['theory'::text, 'bits'::text, 'numerals'::text, 'instacue'::text])),
  delta_ms integer NOT NULL CHECK (delta_ms > 0 AND delta_ms <= 3600000),
  bits_question_index integer NULL,
  client_session_id text NULL,
  tags text[] NOT NULL DEFAULT '{}'::text[],
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (id)
);

COMMENT ON TABLE public.student_learning_dwell IS
  'Active learning dwell samples in one table (user, content, panel, tags, meta). Filter via indexes.';

COMMENT ON COLUMN public.student_learning_dwell.tags IS
  'Searchable tags for filtering, e.g. physics, class-12, panel:theory.';

COMMENT ON COLUMN public.student_learning_dwell.meta IS
  'Optional structured analytics payload.';

INSERT INTO public.student_learning_dwell (
  id, user_id, occurred_at, board, subject, class_level, topic, subtopic_name,
  level, panel, delta_ms, bits_question_index, client_session_id, tags, meta
)
SELECT
  id, user_id, occurred_at, board, subject, class_level, topic, subtopic_name,
  level, panel, delta_ms, bits_question_index, client_session_id, tags, meta
FROM public.student_learning_dwell_events;

CREATE INDEX IF NOT EXISTS idx_student_learning_dwell_user_occurred
  ON public.student_learning_dwell (user_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_student_learning_dwell_user_scope
  ON public.student_learning_dwell (user_id, board, subject, class_level, topic, subtopic_name, level);

CREATE INDEX IF NOT EXISTS idx_student_learning_dwell_content_time
  ON public.student_learning_dwell (subject, topic, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_student_learning_dwell_occurred_at
  ON public.student_learning_dwell (occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_student_learning_dwell_panel_time
  ON public.student_learning_dwell (panel, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_student_learning_dwell_tags_gin
  ON public.student_learning_dwell USING gin (tags);

CREATE INDEX IF NOT EXISTS idx_student_learning_dwell_meta_gin
  ON public.student_learning_dwell USING gin (meta jsonb_path_ops);

ALTER TABLE public.student_learning_dwell ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS student_learning_dwell_select_own ON public.student_learning_dwell;
CREATE POLICY student_learning_dwell_select_own
  ON public.student_learning_dwell FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS student_learning_dwell_insert_own ON public.student_learning_dwell;
CREATE POLICY student_learning_dwell_insert_own
  ON public.student_learning_dwell FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS student_learning_dwell_select_active_buddy ON public.student_learning_dwell;
CREATE POLICY student_learning_dwell_select_active_buddy
  ON public.student_learning_dwell FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.study_buddies sb
      WHERE sb.user_id = (select auth.uid())
        AND sb.status = 'active'
        AND sb.buddy_user_id = student_learning_dwell.user_id
    )
  );

GRANT SELECT, INSERT ON public.student_learning_dwell TO authenticated;
GRANT ALL ON public.student_learning_dwell TO service_role;

-- Drop partitioned parent + all monthly children from the sidebar.
DROP TABLE IF EXISTS public.student_learning_dwell_events CASCADE;

-- Partition helpers become no-ops.
CREATE OR REPLACE FUNCTION public.ensure_dwell_events_partition(p_month date DEFAULT (date_trunc('month'::text, now()))::date)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN 'noop:single_table_student_learning_dwell';
END;
$$;

CREATE OR REPLACE FUNCTION public.prune_empty_dwell_partitions(p_months_ahead integer DEFAULT 1, p_months_behind integer DEFAULT 2)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN jsonb_build_object(
    'dropped_count', 0,
    'note', 'noop: student_learning_dwell is a single table'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.prune_telemetry_logs(p_ai_token_days integer DEFAULT 90, p_dwell_days integer DEFAULT 180)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_ai bigint := 0;
  v_dwell bigint := 0;
BEGIN
  IF p_ai_token_days < 7 OR p_ai_token_days > 365 THEN
    RAISE EXCEPTION 'p_ai_token_days must be between 7 and 365';
  END IF;
  IF p_dwell_days < 7 OR p_dwell_days > 730 THEN
    RAISE EXCEPTION 'p_dwell_days must be between 7 and 730';
  END IF;

  DELETE FROM public.ai_token_logs
  WHERE created_at < now() - make_interval(days => p_ai_token_days);
  GET DIAGNOSTICS v_ai = ROW_COUNT;

  DELETE FROM public.student_learning_dwell
  WHERE occurred_at < now() - make_interval(days => p_dwell_days);
  GET DIAGNOSTICS v_dwell = ROW_COUNT;

  RETURN jsonb_build_object(
    'ai_token_logs_deleted', v_ai,
    'dwell_events_deleted', v_dwell,
    'ai_token_retention_days', p_ai_token_days,
    'dwell_retention_days', p_dwell_days
  );
END;
$$;
