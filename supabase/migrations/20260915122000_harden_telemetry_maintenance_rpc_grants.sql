-- Harden SECURITY DEFINER telemetry maintenance RPCs (service_role only).

DO $$
BEGIN
  IF to_regprocedure('public.ensure_dwell_events_partition(date)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.ensure_dwell_events_partition(date) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.ensure_dwell_events_partition(date) TO service_role;
  END IF;

  IF to_regprocedure('public.prune_empty_dwell_partitions(integer, integer)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.prune_empty_dwell_partitions(integer, integer) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.prune_empty_dwell_partitions(integer, integer) TO service_role;
  END IF;

  IF to_regprocedure('public.prune_telemetry_logs(integer, integer)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.prune_telemetry_logs(integer, integer) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.prune_telemetry_logs(integer, integer) TO service_role;
  END IF;
END $$;
