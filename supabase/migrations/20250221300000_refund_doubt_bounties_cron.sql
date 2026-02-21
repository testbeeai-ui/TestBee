-- Schedule daily refund of expired doubt bounties (7-day rule).
-- Prerequisite: enable pg_cron in Supabase Dashboard (Database → Extensions → pg_cron).
-- Alternative: call POST /api/cron/refund-doubt-bounties daily (e.g. Vercel Cron with CRON_SECRET).

SELECT cron.schedule(
  'refund-expired-doubt-bounties',
  '0 0 * * *',
  $$SELECT public.refund_expired_doubt_bounties()$$
);
