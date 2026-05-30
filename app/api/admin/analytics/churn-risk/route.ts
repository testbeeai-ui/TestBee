import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { isAdminUser } from "@/lib/admin/admin";
import { createAdminClient } from "@/integrations/supabase/server";

const CACHE_KEY = "churn_risk";

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

    // Try to read from cache
    const { data: cached } = await (admin as any)
      .from("admin_analytics_cache")
      .select("data, refreshed_at")
      .eq("key", CACHE_KEY)
      .maybeSingle();

    if (cached) {
      return NextResponse.json(
        { ...cached.data, cachedAt: cached.refreshed_at },
        { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=120" } }
      );
    }

    // No cache — compute fresh
    const { data, error } = await (admin as any).rpc("admin_churn_risk", { p_limit: 200 });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Store in cache
    await (admin as any)
      .from("admin_analytics_cache")
      .upsert({ key: CACHE_KEY, data, refreshed_at: new Date().toISOString() });

    return NextResponse.json(data, {
      headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=120" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
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

    // Force refresh
    const { data, error } = await (admin as any).rpc("admin_churn_risk", { p_limit: 200 });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Update cache
    await (admin as any)
      .from("admin_analytics_cache")
      .upsert({ key: CACHE_KEY, data, refreshed_at: new Date().toISOString() });

    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-cache" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
