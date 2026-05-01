import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";
import { isAdminUser } from "@/lib/admin";
import { createAdminClient } from "@/integrations/supabase/server";

type AuditRow = {
  id: string;
  actionType: string;
  createdAt: string;
  actorUserId: string;
  details: string | null;
};

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdminUser(ctx.supabase, ctx.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const teacherId = id?.trim();
    if (!teacherId) return NextResponse.json({ error: "Invalid teacher id" }, { status: 400 });

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 500 });
    }

    const url = new URL(request.url);
    const rawLimit = Number(url.searchParams.get("limit") ?? 50);
    const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(200, rawLimit)) : 50;

    // Table is referenced elsewhere; may not exist in some envs. Return empty instead of hard fail.
    const res = await (admin as any)
      .from("admin_user_actions")
      .select("id, action_type, reason, created_at, actor_user_id")
      .eq("target_user_id", teacherId)
      .order("created_at", { ascending: false })
      .limit(limit);

    const missingTable = Boolean(
      res.error && /admin_user_actions|schema cache|does not exist|relation/i.test(res.error.message)
    );
    if (res.error && !missingTable) {
      return NextResponse.json({ error: res.error.message }, { status: 500 });
    }

    const rows: AuditRow[] = ((missingTable ? [] : res.data) ?? []).map((r: any) => ({
      id: String(r.id),
      actionType: String(r.action_type ?? "unknown"),
      createdAt: String(r.created_at ?? new Date().toISOString()),
      actorUserId: String(r.actor_user_id ?? "unknown"),
      details: typeof r.reason === "string" ? r.reason : null,
    }));

    return NextResponse.json({ rows });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

