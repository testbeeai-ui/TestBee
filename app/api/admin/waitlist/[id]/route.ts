import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { isAdminUser } from "@/lib/admin/admin";
import { createAdminClient } from "@/integrations/supabase/server";
import { waitlistSubmissionsTable } from "@/lib/waitlist/waitlistDb";
import type { WaitlistAdminStatus } from "@/lib/waitlist/waitlistDb";

function isWaitlistAdminStatus(v: unknown): v is WaitlistAdminStatus {
  return v === "new" || v === "reviewed" || v === "resolved";
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
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

    const { id } = await context.params;
    let body: { admin_status?: unknown; admin_note?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const patch: Record<string, any> = {};
    if (body.admin_status !== undefined) {
      if (!isWaitlistAdminStatus(body.admin_status)) {
        return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
      }
      patch.admin_status = body.admin_status;
      patch.reviewed_at = new Date().toISOString();
      patch.reviewed_by = ctx.user.id;
    }
    if (body.admin_note !== undefined) {
      patch.admin_note =
        typeof body.admin_note === "string" ? body.admin_note.trim().slice(0, 4000) : null;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const { data, error } = await waitlistSubmissionsTable(admin)
      .update(patch)
      .eq("id", id)
      .select("id, admin_status, admin_note, reviewed_at")
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ ok: true, row: data });
  } catch (err) {
    console.error("[PATCH /api/admin/waitlist/[id]] Server error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
