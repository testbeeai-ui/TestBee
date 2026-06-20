-- Phase 2: drop verified-unused indexes, add hot FK indexes, telemetry retention RPC.

BEGIN;

-- Redundant with UNIQUE (paper_id, sort_order) constraint index
DROP INDEX IF EXISTS public.idx_past_paper_questions_paper_sort;

-- Unused at 38 users; created_at + user_id indexes cover admin scans
DROP INDEX IF EXISTS public.ai_token_logs_action_type_idx;

-- Hot paths: RLS EXISTS on teacher_id / classroom_id
CREATE INDEX IF NOT EXISTS idx_classrooms_teacher_id
  ON public.classrooms (teacher_id);

CREATE INDEX IF NOT EXISTS idx_posts_teacher_id
  ON public.posts (teacher_id);

CREATE INDEX IF NOT EXISTS idx_live_sessions_classroom_id
  ON public.live_sessions (classroom_id);

CREATE INDEX IF NOT EXISTS idx_classroom_assignment_responses_classroom_id
  ON public.classroom_assignment_responses (classroom_id);

-- Retention: prune old telemetry (call from /api/cron/prune-telemetry-logs)
CREATE OR REPLACE FUNCTION public.prune_telemetry_logs(
  p_ai_token_days integer DEFAULT 90,
  p_dwell_days integer DEFAULT 180
)
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

  DELETE FROM public.student_learning_dwell_events
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

REVOKE ALL ON FUNCTION public.prune_telemetry_logs(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prune_telemetry_logs(integer, integer) TO service_role;

COMMIT;
