-- Schedule daily refund of expired doubt bounties (7-day rule).
-- Prerequisite: enable pg_cron in Supabase Dashboard (Database → Extensions → pg_cron).
-- Alternative: call POST /api/cron/refund-doubt-bounties daily (e.g. Vercel Cron with CRON_SECRET).

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
      'refund-expired-doubt-bounties',
      '0 0 * * *',
      $cmd$SELECT public.refund_expired_doubt_bounties()$cmd$
    );
  ELSE
    RAISE NOTICE 'pg_cron not available: skipped scheduling refund_expired_doubt_bounties (enable pg_cron in Dashboard or use external cron).';
  END IF;
END $$;
