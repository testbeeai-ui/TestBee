import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { isAdminUser } from "@/lib/admin/admin";
import { createAdminClient } from "@/integrations/supabase/server";
import { sendTeacherMotivation } from "@/lib/teacherPortal/sendTeacherMotivation";
import { auditAdminTeacherAction } from "../../_audit";

type Body = {
  classroomId?: string;
  sectionId?: string | null;
  actionKind?: "boost" | "nudge" | "urgent_nudge" | "reward_top_students";
  targetStudentIds?: string[];
  message?: string;
  rdmDelta?: number;
  notes?: string;
  relatedPostId?: string;
  relatedPostTitle?: string;
  recommendActionId?:
    | "attempt_targeted_mock"
    | "post_doubt"
    | "watch_recorded"
    | "concept_focus_resource"
    | "none";
  recommendActionLabel?: string;
  recommendActionUrl?: string;
  notificationTitle?: string;
  nudgeGoal?:
    | "restart_streak"
    | "complete_pending_assignment"
    | "attempt_mock"
    | "answer_doubts"
    | "revise_chapter"
    | "watch_recorded_class";
};

function parseKind(value: unknown): NonNullable<Body["actionKind"]> {
  if (
    value === "boost" ||
    value === "nudge" ||
    value === "urgent_nudge" ||
    value === "reward_top_students"
  ) {
    return value;
  }
  return "boost";
}

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

    const kind = parseKind(body.actionKind);
    const targetStudentIds = Array.isArray(body.targetStudentIds)
      ? body.targetStudentIds.filter(
          (x): x is string => typeof x === "string" && x.trim().length > 0
        )
      : [];
    if (targetStudentIds.length === 0) {
      return NextResponse.json({ error: "targetStudentIds is required" }, { status: 400 });
    }
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const rdmDelta = Number.isFinite(body.rdmDelta) ? Number(body.rdmDelta) : 0;

    const sendResult = await sendTeacherMotivation(
      admin,
      {
        teacherId,
        classroomId,
        sectionId: typeof body.sectionId === "string" ? body.sectionId : null,
        actionKind: kind,
        targetStudentIds,
        message,
        rdmDelta,
        relatedPostId:
          typeof body.relatedPostId === "string" && body.relatedPostId.trim()
            ? body.relatedPostId.trim()
            : undefined,
        relatedPostTitle:
          typeof body.relatedPostTitle === "string" && body.relatedPostTitle.trim()
            ? body.relatedPostTitle.trim()
            : undefined,
        recommendActionId: body.recommendActionId,
        recommendActionLabel:
          typeof body.recommendActionLabel === "string" ? body.recommendActionLabel : undefined,
        recommendActionUrl:
          typeof body.recommendActionUrl === "string" ? body.recommendActionUrl : undefined,
        notificationTitle:
          typeof body.notificationTitle === "string" ? body.notificationTitle : undefined,
        nudgeGoal: body.nudgeGoal,
      },
      { skipVerificationCheck: true }
    );

    await auditAdminTeacherAction({
      admin,
      actorUserId: ctx.user.id,
      targetTeacherId: teacherId,
      actionType: "teacher_motivation_send",
      reason: notes,
      newState: {
        classroomId,
        classroomName: classroom?.name ?? null,
        actionKind: kind,
        targetCount: targetStudentIds.length,
        rdmDelta: sendResult.effectiveRdmDelta,
        teacherCharged: sendResult.teacherCharged,
        grantsCreated: sendResult.grantsCreated,
      },
    });

    return NextResponse.json({ ok: true, ...sendResult });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
