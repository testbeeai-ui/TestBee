import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { isAdminUser } from "@/lib/admin/admin";
import { createAdminClient } from "@/integrations/supabase/server";
import { waitlistSubmissionsTable, type WaitlistSubmissionDbRow } from "@/lib/waitlist/waitlistDb";

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
    const statusFilter = (url.searchParams.get("status") ?? "all").toLowerCase();
    const roleFilter = (url.searchParams.get("role") ?? "all").toLowerCase();
    const searchQuery = (url.searchParams.get("search") ?? "").trim();
    const rawLimit = Number(url.searchParams.get("limit") ?? 100);
    const limit = Number.isFinite(rawLimit)
      ? Math.max(1, Math.min(300, Math.floor(rawLimit)))
      : 100;

    const table = waitlistSubmissionsTable(admin);
    let query = table.select("*").order("created_at", { ascending: false });

    // Apply status filter
    if (statusFilter === "new" || statusFilter === "reviewed" || statusFilter === "resolved") {
      query = query.eq("admin_status", statusFilter);
    } else if (statusFilter !== "all") {
      return NextResponse.json({ error: "Invalid status filter" }, { status: 400 });
    }

    // Apply role filter
    if (roleFilter === "student" || roleFilter === "teacher" || roleFilter === "parent" || roleFilter === "other") {
      query = query.eq("role", roleFilter);
    } else if (roleFilter !== "all") {
      return NextResponse.json({ error: "Invalid role filter" }, { status: 400 });
    }

    // Apply search filter (name, email, or phone)
    if (searchQuery) {
      query = query.or(`first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`);
    }

    // Add limit
    query = query.limit(limit);

    const { data: rows, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Overview counters
    const { count: totalCount } = await table.select("id", { count: "exact", head: true });
    const { count: newCount } = await table
      .select("id", { count: "exact", head: true })
      .eq("admin_status", "new");

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: last7 } = await table
      .select("id", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgo);

    // Get count of each role
    const { data: roleCountsRaw, error: roleError } = await table.select("role");
    const roleBreakdowns = { student: 0, teacher: 0, parent: 0, other: 0 };
    if (!roleError && roleCountsRaw) {
      for (const item of roleCountsRaw) {
        const r = item.role as keyof typeof roleBreakdowns;
        if (r in roleBreakdowns) roleBreakdowns[r]++;
      }
    }

    const overview = {
      total: totalCount ?? 0,
      newCount: newCount ?? 0,
      last7Days: last7 ?? 0,
      byRole: Object.entries(roleBreakdowns).map(([role, count]) => ({ role, count })),
    };

    return NextResponse.json({
      rows: rows ?? [],
      overview,
      calculatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[GET /api/admin/waitlist] Server error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
