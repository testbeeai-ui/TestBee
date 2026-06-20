-- Archive (deactivate) classroom sections after their schedule_end_date passes.
-- Requires pg_cron for automatic scheduling, otherwise use /api/cron/archive-classroom-sections.

BEGIN;

ALTER TABLE public.classroom_sections
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE OR REPLACE FUNCTION public.archive_expired_classroom_sections()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  updated_count integer := 0;
BEGIN
  UPDATE public.classroom_sections
  SET is_active = false,
      archived_at = COALESCE(archived_at, now()),
      updated_at = now()
  WHERE is_active = true
    AND schedule_end_date IS NOT NULL
    AND schedule_end_date ~ '^\d{4}-\d{2}-\d{2}$'
    AND (schedule_end_date::date) < (CURRENT_DATE);

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- Schedule daily at 00:10 UTC (if pg_cron is available).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron')
     AND EXISTS (
       SELECT 1
       FROM pg_proc p
       JOIN pg_namespace n ON p.pronamespace = n.oid
       WHERE n.nspname = 'cron' AND p.proname = 'schedule'
     ) THEN
    PERFORM cron.schedule(
      'archive-expired-classroom-sections',
      '10 0 * * *',
      $cmd$SELECT public.archive_expired_classroom_sections()$cmd$
    );
  ELSE
    RAISE NOTICE 'pg_cron not available: skipped scheduling archive_expired_classroom_sections (enable pg_cron in Dashboard or use external cron).';
  END IF;
END $$;

COMMIT;

