-- Phase 2: drop empty dwell partition shells outside a rolling window.
-- Never drops a partition that still has rows.

BEGIN;

CREATE OR REPLACE FUNCTION public.prune_empty_dwell_partitions(
  p_months_ahead integer DEFAULT 12,
  p_months_behind integer DEFAULT 6
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  r record;
  part_month date;
  window_start date;
  window_end date;
  row_count bigint;
  dropped text[] := '{}';
  kept text[] := '{}';
  skipped_nonempty text[] := '{}';
BEGIN
  IF p_months_ahead < 1 OR p_months_ahead > 24 THEN
    RAISE EXCEPTION 'p_months_ahead must be between 1 and 24';
  END IF;
  IF p_months_behind < 1 OR p_months_behind > 24 THEN
    RAISE EXCEPTION 'p_months_behind must be between 1 and 24';
  END IF;

  window_start := (date_trunc('month', now()) - make_interval(months => p_months_behind))::date;
  window_end := (date_trunc('month', now()) + make_interval(months => p_months_ahead + 1))::date;

  PERFORM public.ensure_dwell_events_partition(date_trunc('month', now())::date);
  PERFORM public.ensure_dwell_events_partition((date_trunc('month', now()) + interval '1 month')::date);

  FOR r IN
    SELECT c.relname AS part_name
    FROM pg_inherits i
    JOIN pg_class c ON c.oid = i.inhrelid
    JOIN pg_class p ON p.oid = i.inhparent
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND p.relname = 'student_learning_dwell_events'
      AND c.relname ~ '^student_learning_dwell_[0-9]{4}_[0-9]{2}$'
  LOOP
    part_month := to_date(substring(r.part_name from '([0-9]{4}_[0-9]{2})$'), 'YYYY_MM');

    EXECUTE format('SELECT count(*)::bigint FROM public.%I', r.part_name) INTO row_count;

    IF row_count > 0 THEN
      skipped_nonempty := array_append(skipped_nonempty, r.part_name);
      CONTINUE;
    END IF;

    IF part_month >= window_start AND part_month < window_end THEN
      kept := array_append(kept, r.part_name);
      CONTINUE;
    END IF;

    EXECUTE format('DROP TABLE public.%I', r.part_name);
    dropped := array_append(dropped, r.part_name);
  END LOOP;

  RETURN jsonb_build_object(
    'dropped', dropped,
    'dropped_count', coalesce(array_length(dropped, 1), 0),
    'kept_empty_in_window', kept,
    'kept_nonempty', skipped_nonempty,
    'window_start', window_start,
    'window_end_exclusive', window_end,
    'months_ahead', p_months_ahead,
    'months_behind', p_months_behind
  );
END;
$$;

COMMENT ON FUNCTION public.prune_empty_dwell_partitions IS
  'Drop empty student_learning_dwell_* monthly partitions outside rolling window. Skips any partition with rows.';

REVOKE ALL ON FUNCTION public.prune_empty_dwell_partitions(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prune_empty_dwell_partitions(integer, integer) TO service_role;

-- One-time shrink: 6 months behind, 12 months ahead (matches dwell row retention ~180d).
SELECT public.prune_empty_dwell_partitions(12, 6);

COMMIT;
