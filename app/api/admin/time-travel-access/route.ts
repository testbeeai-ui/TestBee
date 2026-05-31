import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { isAdminUser } from "@/lib/admin/admin";
import { createAdminClient } from "@/integrations/supabase/server";

export async function GET(request: NextRequest) {
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

    // 1. Fetch auth users to map emails
    const authRes = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (authRes.error) {
      return NextResponse.json({ error: authRes.error.message }, { status: 500 });
    }
    const authUsers = authRes.data.users ?? [];

    // 2. Fetch all student profiles
    const { data: profiles, error: profilesError } = await (admin as any)
      .from("profiles")
      .select("id, name, plan_tier, time_travel_enabled, subscription_started_at")
      .eq("role", "student");

    if (profilesError) {
      return NextResponse.json({ error: profilesError.message }, { status: 500 });
    }

    // 3. Map profiles with emails
    const profileById = new Map<string, any>((profiles ?? []).map((p: any) => [p.id, p]));
    const students = authUsers
      .map((u) => {
        const p = profileById.get(u.id);
        if (!p) return null;
        return {
          id: u.id,
          email: u.email ?? null,
          name: p.name ?? null,
          plan_tier: p.plan_tier ?? "free",
          subscription_started_at: p.subscription_started_at ?? null,
          time_travel_enabled: Boolean((p as any).time_travel_enabled),
        };
      })
      .filter(Boolean);

    return NextResponse.json({ students });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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

    const json = await request.json();
    const userId = typeof json.userId === "string" ? json.userId.trim() : "";
    const enabled = Boolean(json.enabled);

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const { error } = await (admin as any)
      .from("profiles")
      .update({ time_travel_enabled: enabled })
      .eq("id", userId);

    if (error) {
      console.error("[admin/time-travel-access POST]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
