import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { isAdminUser } from "@/lib/admin/admin";
import { createAdminClient } from "@/integrations/supabase/server";
import { auditAdminTeacherAction } from "../../_audit";

type Body = {
  sessionId?: string;
  action?: "cancel" | "update";
  title?: string;
  scheduledAt?: string;
  durationMinutes?: number;
  meetLink?: string | null;
  status?: string | null;
  notes?: string;
};

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
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
    const teacherId = id?.trim();
    if (!teacherId) return NextResponse.json({ error: "Invalid teacher id" }, { status: 400 });

    const body = (await request.json()) as Body;
    const notes = typeof body.notes === "string" ? body.notes.trim() : "";
    if (!notes) return NextResponse.json({ error: "notes is required for audit" }, { status: 400 });

    const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
    if (!sessionId) return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    const action = body.action === "cancel" || body.action === "update" ? body.action : "update";

    const { data: session, error: sErr } = await admin
      .from("live_sessions")
      .select("*")
      .eq("id", sessionId)
      .maybeSingle();
    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    if ((session as any).teacher_id !== teacherId) {
      return NextResponse.json(
        { error: "Session does not belong to this teacher" },
        { status: 400 }
      );
    }

    if (action === "cancel") {
      const { error: updErr } = await admin
        .from("live_sessions")
        .update({ status: "cancelled" })
        .eq("id", sessionId);
      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
      await auditAdminTeacherAction({
        admin,
        actorUserId: ctx.user.id,
        targetTeacherId: teacherId,
        actionType: "teacher_session_cancel",
        reason: notes,
        oldState: { sessionId, status: (session as any).status ?? null },
        newState: { sessionId, status: "cancelled" },
      });
      return NextResponse.json({ ok: true });
    }

    const patch: Record<string, unknown> = {};
    if (typeof body.title === "string" && body.title.trim()) patch.title = body.title.trim();
    if (typeof body.scheduledAt === "string" && body.scheduledAt.trim())
      patch.scheduled_at = body.scheduledAt.trim();
    if (Number.isFinite(body.durationMinutes) && Number(body.durationMinutes) > 0)
      patch.duration_minutes = Math.floor(Number(body.durationMinutes));
    if (typeof body.meetLink === "string") patch.meet_link = body.meetLink.trim() || null;
    if (typeof body.status === "string") patch.status = body.status.trim() || null;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const { error: updErr } = await admin.from("live_sessions").update(patch).eq("id", sessionId);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

    await auditAdminTeacherAction({
      admin,
      actorUserId: ctx.user.id,
      targetTeacherId: teacherId,
      actionType: "teacher_session_update",
      reason: notes,
      oldState: {
        sessionId,
        title: (session as any).title,
        scheduledAt: (session as any).scheduled_at,
      },
      newState: { sessionId, ...patch },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
