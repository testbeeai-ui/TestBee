import type { SupabaseClient } from "@supabase/supabase-js";
import { refreshAdminAnalyticsCache } from "@/lib/admin/adminAnalyticsCache";

type AdminRpcClient = SupabaseClient & {
  rpc(fn: string, args?: Record<string, unknown>): ReturnType<SupabaseClient["rpc"]>;
};

/**
 * Pre-warm expensive admin analytics RPCs into admin_analytics_cache.
 * Call from /api/cron/warm-admin-analytics (manual/external cron).
 */
export async function warmAdminAnalyticsCache(
  admin: SupabaseClient
): Promise<{ keys: string[] }> {
  const db = admin as AdminRpcClient;
  const keys: string[] = [];

  const jobs: Array<{ key: string; run: () => Promise<unknown> }> = [
    {
      key: "analytics_summary",
      run: async () => {
        const { data, error } = await db.rpc("admin_analytics_summary");
        if (error) throw new Error(error.message);
        return data;
      },
    },
    {
      key: "churn_risk",
      run: async () => {
        const { data, error } = await db.rpc("admin_churn_risk", { p_limit: 200 });
        if (error) throw new Error(error.message);
        return data;
      },
    },
    {
      key: "conversion_funnel",
      run: async () => {
        const { data, error } = await db.rpc("admin_conversion_funnel");
        if (error) throw new Error(error.message);
        return data;
      },
    },
    {
      key: "retention_cohorts",
      run: async () => {
        const { data, error } = await db.rpc("admin_retention_cohorts");
        if (error) throw new Error(error.message);
        return data;
      },
    },
    {
      key: "feature_adoption",
      run: async () => {
        const { data, error } = await db.rpc("admin_feature_adoption");
        if (error) throw new Error(error.message);
        return data;
      },
    },
    {
      key: "dropoff_tracking",
      run: async () => {
        const { data, error } = await db.rpc("admin_dropoff_tracking");
        if (error) throw new Error(error.message);
        return data;
      },
    },
    {
      key: "events_30",
      run: async () => {
        const { data, error } = await db.rpc("admin_event_summary", { p_days: 30 });
        if (error) throw new Error(error.message);
        return data;
      },
    },
  ];

  for (const job of jobs) {
    await refreshAdminAnalyticsCache(admin, job.key, job.run);
    keys.push(job.key);
  }

  return { keys };
}
