import type { SupabaseClient } from "@supabase/supabase-js";

type AdminCacheRow<T> = { data: T; refreshed_at: string };

export type CachedAdminAnalyticsResult<T> = {
  data: T;
  cachedAt: string | null;
  fromCache: boolean;
};

// Service-role client; table not in generated Database types yet.
type AdminCacheClient = SupabaseClient & {
  from(table: "admin_analytics_cache"): ReturnType<SupabaseClient["from"]>;
};

function adminCacheTable(admin: SupabaseClient) {
  return (admin as AdminCacheClient).from("admin_analytics_cache");
}

/**
 * Read-through cache for expensive admin analytics RPCs (service_role client).
 */
export async function getCachedAdminAnalytics<T>(
  admin: SupabaseClient,
  key: string,
  maxAgeMs: number,
  compute: () => Promise<T>
): Promise<CachedAdminAnalyticsResult<T>> {
  const { data: cached } = await adminCacheTable(admin)
    .select("data, refreshed_at")
    .eq("key", key)
    .maybeSingle();

  const row = cached as AdminCacheRow<T> | null;
  if (row?.refreshed_at) {
    const ageMs = Date.now() - new Date(row.refreshed_at).getTime();
    if (ageMs >= 0 && ageMs < maxAgeMs) {
      return { data: row.data, cachedAt: row.refreshed_at, fromCache: true };
    }
  }

  const data = await compute();
  const refreshedAt = new Date().toISOString();
  await adminCacheTable(admin).upsert({ key, data, refreshed_at: refreshedAt });

  return { data, cachedAt: refreshedAt, fromCache: false };
}

/** Force refresh and overwrite cache entry (admin POST refresh). */
export async function refreshAdminAnalyticsCache<T>(
  admin: SupabaseClient,
  key: string,
  compute: () => Promise<T>
): Promise<{ data: T; cachedAt: string }> {
  const data = await compute();
  const refreshedAt = new Date().toISOString();
  await adminCacheTable(admin).upsert({ key, data, refreshed_at: refreshedAt });
  return { data, cachedAt: refreshedAt };
}
