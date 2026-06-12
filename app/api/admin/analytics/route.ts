import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { isAdminUser } from "@/lib/admin/admin";
import { getCachedAdminAnalytics } from "@/lib/admin/adminAnalyticsCache";
import { ADMIN_ANALYTICS_CACHE_TTL_MS } from "@/lib/admin/adminAnalyticsConfig";
import { createAdminClient } from "@/integrations/supabase/server";

const CACHE_KEY = "analytics_summary";

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

    const { data, cachedAt, fromCache } = await getCachedAdminAnalytics(
      admin,
      CACHE_KEY,
      ADMIN_ANALYTICS_CACHE_TTL_MS,
      async () => {
        const { data: fresh, error } = await admin.rpc("admin_analytics_summary");
        if (error) throw new Error(error.message);
        return fresh;
      }
    );

    return NextResponse.json(
      { ...(data as object), cachedAt, fromCache },
      {
        headers: {
          "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
