import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { isAdminUser } from "@/lib/admin/admin";
import { createAdminClient } from "@/integrations/supabase/server";
import { createClassroomAssignment } from "@/lib/teacherPortal/queries";
import { auditAdminTeacherAction } from "../../_audit";

type Body = {
  classroomId?: string;
  sectionId?: string | null;
  assignmentType?: string;
  title?: string;
  dueDate?: string | null;
  assignToLabel?: string;
  targetStudentIds?: string[] | null;
  rewardRdm?: number;
  instructions?: string;
  notes?: string;
  extraContentJson?: Record<string, unknown> | null;
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

    const classroomId = typeof body.classroomId === "string" ? body.classroomId.trim() : "";
    if (!classroomId)
      return NextResponse.json({ error: "classroomId is required" }, { status: 400 });

    const { data: classroom, error: cErr } = await (admin as any)
      .from("classrooms")
      .select("id, teacher_id, name")
      .eq("id", classroomId)
      .maybeSingle();
    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });
    if (!classroom) return NextResponse.json({ error: "Classroom not found" }, { status: 404 });
    if (classroom.teacher_id !== teacherId) {
      return NextResponse.json(
        { error: "Classroom does not belong to this teacher" },
        { status: 400 }
      );
    }

    const created = await createClassroomAssignment(
      {
        teacherId,
        classroomId,
        sectionId: typeof body.sectionId === "string" ? body.sectionId : null,
        assignmentType:
          typeof body.assignmentType === "string" ? body.assignmentType : "assignment",
        title: typeof body.title === "string" ? body.title : "",
        dueDate: typeof body.dueDate === "string" ? body.dueDate : null,
        assignToLabel: typeof body.assignToLabel === "string" ? body.assignToLabel : "All students",
        targetStudentIds: Array.isArray(body.targetStudentIds) ? body.targetStudentIds : null,
        rewardRdm: Number.isFinite(body.rewardRdm) ? Number(body.rewardRdm) : 10,
        instructions: typeof body.instructions === "string" ? body.instructions : "",
        extraContentJson: (body.extraContentJson ?? null) as any,
      },
      admin as any,
      { skipVerificationCheck: true, skipPlanQuotaCheck: true }
    );

    await auditAdminTeacherAction({
      admin,
      actorUserId: ctx.user.id,
      targetTeacherId: teacherId,
      actionType: "teacher_assignment_create",
      reason: notes,
      newState: {
        classroomId,
        classroomName: classroom?.name ?? null,
        assignmentId: created.id,
        assignmentType: body.assignmentType ?? "assignment",
        title: body.title ?? null,
      },
    });

    return NextResponse.json({ ok: true, id: created.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
