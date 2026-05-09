import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";
import { isAdminUser } from "@/lib/admin";
import { createAdminClient } from "@/integrations/supabase/server";
import { updateTeacherProfile } from "@/lib/teacherPortal/queries";
import { auditAdminTeacherAction } from "../../_audit";

type Body = {
  name?: string;
  bio?: string;
  visibility?: string;
  subjects?: string[];
  examTags?: string[];
  teachingLevels?: number[];
  avatarUrl?: string | null;
  details?: Record<string, unknown>;
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
      .select("id, role, name, bio, visibility, subjects, exam_tags, teaching_levels")
      .eq("id", teacherId)
      .maybeSingle();
    if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });
    if (!teacherProfile) return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
    if (teacherProfile.role !== "teacher") {
      return NextResponse.json({ error: "Target user is not a teacher" }, { status: 400 });
    }

    await updateTeacherProfile(
      {
        userId: teacherId,
        name: typeof body.name === "string" ? body.name : (teacherProfile.name ?? "Teacher"),
        bio: typeof body.bio === "string" ? body.bio : "",
        visibility: typeof body.visibility === "string" ? body.visibility : (teacherProfile.visibility ?? "public"),
        subjects: Array.isArray(body.subjects) ? body.subjects : [],
        examTags: Array.isArray(body.examTags) ? body.examTags : [],
        teachingLevels: Array.isArray(body.teachingLevels)
          ? body.teachingLevels.filter((n): n is number => typeof n === "number" && Number.isFinite(n))
          : [],
        avatarUrl: body.avatarUrl !== undefined ? body.avatarUrl : undefined,
        details: body.details as Body["details"],
        bypassVerificationLock: true,
      },
      admin
    );

    await auditAdminTeacherAction({
      admin,
      actorUserId: ctx.user.id,
      targetTeacherId: teacherId,
      actionType: "teacher_profile_update",
      reason: notes,
      oldState: {
        name: teacherProfile.name,
        visibility: teacherProfile.visibility,
        subjects: teacherProfile.subjects ?? null,
        exam_tags: teacherProfile.exam_tags ?? null,
        teaching_levels: teacherProfile.teaching_levels ?? null,
      },
      newState: {
        name: body.name ?? teacherProfile.name,
        visibility: body.visibility ?? teacherProfile.visibility,
        subjects: body.subjects ?? null,
        examTags: body.examTags ?? null,
        teachingLevels: body.teachingLevels ?? null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

