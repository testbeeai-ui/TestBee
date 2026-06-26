import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { isAdminUser } from "@/lib/admin/admin";
import { createAdminClient } from "@/integrations/supabase/server";
import { auditAdminTeacherAction } from "../../_audit";
import type { LiveClassDeliveryAwardResult } from "@/lib/teacherPortal/liveClassDeliveryRdm";

type Body = {
  sectionId?: string;
  occurrenceAt?: string;
  notes?: string;
  forceBeforeEnd?: boolean;
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

    const sectionId = typeof body.sectionId === "string" ? body.sectionId.trim() : "";
    if (!sectionId) return NextResponse.json({ error: "sectionId is required" }, { status: 400 });

    const occurrenceAt = typeof body.occurrenceAt === "string" ? body.occurrenceAt.trim() : "";
    if (!occurrenceAt) return NextResponse.json({ error: "occurrenceAt is required (ISO)" }, { status: 400 });

    const { data: section, error: sErr } = await admin
      .from("classroom_sections")
      .select("id, name, classroom_id")
      .eq("id", sectionId)
      .maybeSingle();
    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });
    if (!section) return NextResponse.json({ error: "Section not found" }, { status: 404 });

    const { data: classroom, error: cErr } = await admin
      .from("classrooms")
      .select("teacher_id")
      .eq("id", (section as { classroom_id: string }).classroom_id)
      .maybeSingle();
    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });
    if (!classroom) return NextResponse.json({ error: "Classroom not found" }, { status: 404 });
    if ((classroom as { teacher_id: string }).teacher_id !== teacherId) {
      return NextResponse.json({ error: "Section does not belong to this teacher" }, { status: 400 });
    }

    const { data, error } = await admin.rpc("award_teacher_section_schedule_occurrence_rdm", {
      p_section_id: sectionId,
      p_occurrence_at: occurrenceAt,
      p_awarded_by: "admin",
      p_force_before_end: Boolean(body.forceBeforeEnd),
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const result = (data ?? {}) as LiveClassDeliveryAwardResult;
    if (!result.ok) {
      const err = result.error ?? "award_failed";
      const status =
        err === "occurrence_not_ended"
          ? 409
          : err === "section_inactive"
            ? 400
            : err === "section_not_found"
              ? 404
              : 400;
      return NextResponse.json({ error: err, result }, { status });
    }

    await auditAdminTeacherAction({
      admin,
      actorUserId: ctx.user.id,
      targetTeacherId: teacherId,
      actionType: "teacher_section_schedule_delivery_rdm",
      reason: notes,
      oldState: {
        sectionId,
        sectionName: (section as { name?: string }).name ?? null,
        occurrenceAt,
      },
      newState: {
        sectionId,
        occurrenceAt,
        totalRdm: result.total_rdm ?? 0,
        alreadyAwarded: Boolean(result.already_awarded),
        forceBeforeEnd: Boolean(body.forceBeforeEnd),
      },
    });

    return NextResponse.json({ ok: true, result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
