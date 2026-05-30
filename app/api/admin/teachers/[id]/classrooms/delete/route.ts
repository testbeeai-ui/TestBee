import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { isAdminUser } from "@/lib/admin/admin";
import { createAdminClient } from "@/integrations/supabase/server";
import { deleteTeacherClassroom } from "@/lib/teacherPortal/queries";
import { auditAdminTeacherAction } from "../../_audit";

type Body = {
  classroomId?: string;
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

    await deleteTeacherClassroom({ teacherId, classroomId }, admin as any, {
      skipVerificationCheck: true,
    });

    await auditAdminTeacherAction({
      admin,
      actorUserId: ctx.user.id,
      targetTeacherId: teacherId,
      actionType: "teacher_classroom_delete",
      reason: notes,
      oldState: { classroomId, name: classroom.name ?? null },
      newState: { classroomId, deleted: true },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
