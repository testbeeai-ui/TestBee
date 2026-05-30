import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { isAdminUser } from "@/lib/admin/admin";
import { createAdminClient } from "@/integrations/supabase/server";
import { updateTeacherClassroom } from "@/lib/teacherPortal/queries";
import { auditAdminTeacherAction } from "../../_audit";

type Body = {
  classroomId?: string;
  name?: string;
  subject?: string | null;
  section?: string | null;
  introVideoUrl?: string | null;
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
      .select("id, teacher_id, name, subject, section, intro_video_url")
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

    await updateTeacherClassroom(
      {
        teacherId,
        classroomId,
        name: typeof body.name === "string" ? body.name : classroom.name,
        subject:
          typeof body.subject === "string" ? body.subject : (body.subject ?? classroom.subject),
        section:
          typeof body.section === "string" ? body.section : (body.section ?? classroom.section),
        introVideoUrl:
          typeof body.introVideoUrl === "string"
            ? body.introVideoUrl
            : (body.introVideoUrl ?? classroom.intro_video_url),
      },
      admin as any,
      { skipVerificationCheck: true }
    );

    await auditAdminTeacherAction({
      admin,
      actorUserId: ctx.user.id,
      targetTeacherId: teacherId,
      actionType: "teacher_classroom_update",
      reason: notes,
      oldState: {
        classroomId,
        name: classroom.name,
        subject: classroom.subject,
        section: classroom.section,
        introVideoUrl: classroom.intro_video_url ?? null,
      },
      newState: {
        classroomId,
        name: body.name ?? classroom.name,
        subject: body.subject ?? classroom.subject,
        section: body.section ?? classroom.section,
        introVideoUrl: body.introVideoUrl ?? classroom.intro_video_url ?? null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
