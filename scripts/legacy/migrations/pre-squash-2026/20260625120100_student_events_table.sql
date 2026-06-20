-- Unified student event tracking table
CREATE TABLE IF NOT EXISTS public.student_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_name text NOT NULL,
  event_data jsonb DEFAULT '{}'::jsonb,
  page text,
  session_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_student_events_user_id_created
  ON public.student_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_student_events_name_created
  ON public.student_events(event_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_student_events_session
  ON public.student_events(session_id, created_at DESC)
  WHERE session_id IS NOT NULL;

-- RLS: users can insert their own events, service_role can read all
ALTER TABLE public.student_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "student_events_insert_own" ON public.student_events;
CREATE POLICY "student_events_insert_own" ON public.student_events
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "student_events_select_own" ON public.student_events;
CREATE POLICY "student_events_select_own" ON public.student_events
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Service role can read all (for admin analytics)
DROP POLICY IF EXISTS "student_events_service_role_all" ON public.student_events;
CREATE POLICY "student_events_service_role_all" ON public.student_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Admin RPC: event funnel analysis
CREATE OR REPLACE FUNCTION public.admin_event_funnel(
  p_event_names text[],
  p_days int DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_total_users int;
  v_start_date timestamptz := now() - (p_days || ' days')::interval;
BEGIN
  -- Total active users in period
  SELECT count(DISTINCT user_id) INTO v_total_users
  FROM student_events
  WHERE created_at >= v_start_date;

  SELECT coalesce(jsonb_agg(row_to_json(t) ORDER BY t.step_order), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT
      unnest(p_event_names) AS event_name,
      generate_series(1, array_length(p_event_names, 1)) AS step_order
  ) steps
  CROSS JOIN LATERAL (
    SELECT
      steps.step_order,
      steps.event_name,
      count(DISTINCT se.user_id)::int AS unique_users,
      CASE WHEN v_total_users > 0
        THEN round(100.0 * count(DISTINCT se.user_id) / v_total_users, 1)
        ELSE 0 END AS pct_of_active
    FROM student_events se
    WHERE se.event_name = steps.event_name
      AND se.created_at >= v_start_date
  ) t;

  RETURN jsonb_build_object(
    'periodDays', p_days,
    'totalActiveUsers', v_total_users,
    'funnel', v_result,
    'generatedAt', to_jsonb(now())
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_event_funnel(text[], int) TO service_role;

-- Admin RPC: event counts by name (top events)
CREATE OR REPLACE FUNCTION public.admin_event_summary(p_days int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start_date timestamptz := now() - (p_days || ' days')::interval;
  v_events jsonb;
  v_total int;
  v_unique_users int;
BEGIN
  SELECT count(*), count(DISTINCT user_id)
  INTO v_total, v_unique_users
  FROM student_events
  WHERE created_at >= v_start_date;

  SELECT coalesce(jsonb_agg(row_to_json(t) ORDER BY t.event_count DESC), '[]'::jsonb)
  INTO v_events
  FROM (
    SELECT
      event_name,
      count(*)::int AS event_count,
      count(DISTINCT user_id)::int AS unique_users,
      round(100.0 * count(*) / NULLIF(sum(count(*)) OVER (), 0), 1) AS pct_of_total
    FROM student_events
    WHERE created_at >= v_start_date
    GROUP BY event_name
    ORDER BY count(*) DESC
    LIMIT 50
  ) t;

  RETURN jsonb_build_object(
    'periodDays', p_days,
    'totalEvents', v_total,
    'uniqueUsers', v_unique_users,
    'events', v_events,
    'generatedAt', to_jsonb(now())
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_event_summary(int) TO service_role;
