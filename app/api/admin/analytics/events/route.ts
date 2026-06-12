import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { isAdminUser } from "@/lib/admin/admin";
import { getCachedAdminAnalytics } from "@/lib/admin/adminAnalyticsCache";
import { ADMIN_ANALYTICS_CACHE_TTL_MS } from "@/lib/admin/adminAnalyticsConfig";
import { createAdminClient } from "@/integrations/supabase/server";

export async function GET(request: Request) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdminUser(ctx.supabase, ctx.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 500 });
    }

    const url = new URL(request.url);
    const days = Math.min(90, Math.max(7, parseInt(url.searchParams.get("days") || "30", 10)));
    const cacheKey = `events_${days}`;

    const { data, cachedAt, fromCache } = await getCachedAdminAnalytics(
      admin,
      cacheKey,
      ADMIN_ANALYTICS_CACHE_TTL_MS,
      async () => {
        const { data: fresh, error } = await (admin as any).rpc(
          "admin_event_summary",
          { p_days: days }
        );
        if (error) throw new Error(error.message);
        return fresh;
      }
    );

    return NextResponse.json(
      { ...(data as object), cachedAt, fromCache, days },
      { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
