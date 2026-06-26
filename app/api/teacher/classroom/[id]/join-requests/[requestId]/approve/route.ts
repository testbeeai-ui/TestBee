import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { enforceSameOriginForCookieAuth } from "@/lib/auth/securityGuards";
import { createAdminClient } from "@/integrations/supabase/server";
import { assertClassroomHasStudentCapacity } from "@/lib/teacherPortal/teacherPlanServer";
import { assertTeacherApprovedForMutations } from "@/lib/teacherPortal/queries";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; requestId: string }> }
) {
  const originBlock = enforceSameOriginForCookieAuth(request);
  if (originBlock) return originBlock;

  const ctx = await getSupabaseAndUser(request);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { user } = ctx;
  const { id: classroomId, requestId } = await context.params;

  if (!classroomId?.trim() || !requestId?.trim()) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const { data: room } = await admin
    .from("classrooms")
    .select("id, teacher_id")
    .eq("id", classroomId)
    .maybeSingle();

  if (!room || room.teacher_id !== user.id) {
    return NextResponse.json({ error: "Classroom not found" }, { status: 404 });
  }

  try {
    await assertTeacherApprovedForMutations(user.id, admin, { skipVerificationCheck: false });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Verification required";
    return NextResponse.json({ error: msg }, { status: 403 });
  }

  const capCheck = await assertClassroomHasStudentCapacity(user.id, classroomId, 1);
  if (!capCheck.ok) {
    return NextResponse.json({ error: capCheck.error, code: capCheck.code }, { status: 403 });
  }

  const { data: joinReq, error: joinErr } = await admin
    .from("classroom_join_requests")
    .select("id, user_id, status")
    .eq("id", requestId)
    .eq("classroom_id", classroomId)
    .maybeSingle();

  if (joinErr) return NextResponse.json({ error: joinErr.message }, { status: 500 });
  if (!joinReq) return NextResponse.json({ error: "Join request not found" }, { status: 404 });
  if (joinReq.status !== "pending") {
    return NextResponse.json({ error: "Join request is not pending" }, { status: 409 });
  }

  const { error: insertErr } = await admin.from("classroom_members").insert({
    classroom_id: classroomId,
    user_id: joinReq.user_id,
    role: "student",
  });

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  const { error: updErr } = await admin
    .from("classroom_join_requests")
    .update({
      status: "approved",
      responded_at: new Date().toISOString(),
      responded_by: user.id,
    })
    .eq("id", requestId);

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
