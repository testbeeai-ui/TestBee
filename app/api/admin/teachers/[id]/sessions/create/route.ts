import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { isAdminUser } from "@/lib/admin/admin";
import { createAdminClient } from "@/integrations/supabase/server";
import { createTeacherLiveSession } from "@/lib/teacherPortal/queries";
import { auditAdminTeacherAction } from "../../_audit";

type Body = {
  classroomId?: string;
  sectionId?: string | null;
  title?: string;
  date?: string;
  startTime?: string;
  durationMinutes?: number;
  meetLink?: string;
  allowAdhocTrial?: boolean;
  preWork?: string;
  postWork?: string;
  preWorkMode?: "none" | "custom" | "concept_focus";
  postWorkMode?: "none" | "custom" | "concept_focus";
  preWorkConceptRef?: Record<string, unknown> | null;
  postWorkConceptRef?: Record<string, unknown> | null;
  postWorkDelayDays?: number;
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

    await createTeacherLiveSession(
      {
        teacherId,
        classroomId,
        sectionId: typeof body.sectionId === "string" ? body.sectionId : null,
        title: typeof body.title === "string" ? body.title : "",
        date: typeof body.date === "string" ? body.date : "",
        startTime: typeof body.startTime === "string" ? body.startTime : "",
        durationMinutes: Number.isFinite(body.durationMinutes) ? Number(body.durationMinutes) : 60,
        meetLink: typeof body.meetLink === "string" ? body.meetLink : "",
        allowAdhocTrial: Boolean(body.allowAdhocTrial),
        preWork: typeof body.preWork === "string" ? body.preWork : "",
        postWork: typeof body.postWork === "string" ? body.postWork : "",
        preWorkMode: body.preWorkMode,
        postWorkMode: body.postWorkMode,
        // These optional fields are validated inside createTeacherLiveSession when used.
        preWorkConceptRef: (body.preWorkConceptRef ?? null) as any,
        postWorkConceptRef: (body.postWorkConceptRef ?? null) as any,
        postWorkDelayDays: body.postWorkDelayDays,
      },
      admin as any,
      { skipVerificationCheck: true }
    );

    await auditAdminTeacherAction({
      admin,
      actorUserId: ctx.user.id,
      targetTeacherId: teacherId,
      actionType: "teacher_session_create",
      reason: notes,
      oldState: { classroomId },
      newState: {
        classroomId,
        classroomName: classroom?.name ?? null,
        title: body.title ?? null,
        date: body.date ?? null,
        startTime: body.startTime ?? null,
        durationMinutes: body.durationMinutes ?? 60,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
