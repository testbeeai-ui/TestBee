import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";
import { isAdminUser } from "@/lib/admin";
import { createAdminClient } from "@/integrations/supabase/server";
import { createTeacherClassroom } from "@/lib/teacherPortal/queries";
import { auditAdminTeacherAction } from "../../_audit";

type Body = {
  name?: string;
  subject?: string;
  pucLevel?: "PUC 1" | "PUC 2" | "Both";
  examTarget?: string;
  scheduleDate?: string | null;
  scheduleTime?: string | null;
  durationMinutes?: number;
  repeatDays?: string[];
  scheduleEndDate?: string | null;
  allowAdhocTrial?: boolean;
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

    const { data: teacherProfile, error: tErr } = await admin
      .from("profiles")
      .select("id, role")
      .eq("id", teacherId)
      .maybeSingle();
    if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });
    if (!teacherProfile) return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
    if (teacherProfile.role !== "teacher") {
      return NextResponse.json({ error: "Target user is not a teacher" }, { status: 400 });
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const subject = typeof body.subject === "string" ? body.subject.trim() : "";
    const pucLevel = body.pucLevel ?? "Both";
    const examTarget = typeof body.examTarget === "string" ? body.examTarget.trim() : "General";

    const { classroomId } = await createTeacherClassroom(
      {
        userId: teacherId,
        name,
        subject,
        pucLevel,
        examTarget,
        scheduleDate: typeof body.scheduleDate === "string" ? body.scheduleDate : null,
        scheduleTime: typeof body.scheduleTime === "string" ? body.scheduleTime : null,
        durationMinutes: Number.isFinite(body.durationMinutes) ? Number(body.durationMinutes) : 60,
        repeatDays: Array.isArray(body.repeatDays) ? body.repeatDays : [],
        scheduleEndDate: typeof body.scheduleEndDate === "string" ? body.scheduleEndDate : null,
        allowAdhocTrial: Boolean(body.allowAdhocTrial),
      },
      admin as any
    );

    await auditAdminTeacherAction({
      admin,
      actorUserId: ctx.user.id,
      targetTeacherId: teacherId,
      actionType: "teacher_classroom_create",
      reason: notes,
      newState: {
        classroomId,
        name,
        subject,
        pucLevel,
        examTarget,
      },
    });

    return NextResponse.json({ ok: true, classroomId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

