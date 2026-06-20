-- Lightweight cache table for expensive analytics RPCs
CREATE TABLE IF NOT EXISTS public.admin_analytics_cache (
  key text NOT NULL PRIMARY KEY,
  data jsonb NOT NULL,
  refreshed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_analytics_cache ENABLE ROW LEVEL SECURITY;

-- Only service_role can read/write (admin API uses service_role)
DROP POLICY IF EXISTS "admin_analytics_cache_service_role" ON public.admin_analytics_cache;
CREATE POLICY "admin_analytics_cache_service_role" ON public.admin_analytics_cache
  FOR ALL TO service_role USING (true) WITH CHECK (true);
