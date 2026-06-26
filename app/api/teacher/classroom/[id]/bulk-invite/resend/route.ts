import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { enforceSameOriginForCookieAuth } from "@/lib/auth/securityGuards";
import { createAdminClient } from "@/integrations/supabase/server";
import { buildClassroomInviteEmail } from "@/lib/email/classroomInviteEmail";
import { isEmailConfigured, sendEmail } from "@/lib/email/emailService";

export const runtime = "nodejs";

type Body = { email?: string };

/** Resend invitation email to an invited student who has not joined yet. */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const originBlock = enforceSameOriginForCookieAuth(request);
  if (originBlock) return originBlock;

  const ctx = await getSupabaseAndUser(request);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isEmailConfigured()) {
    return NextResponse.json({ error: "Email is not configured on the server" }, { status: 503 });
  }

  const { id: classroomId } = await context.params;
  if (!classroomId?.trim()) {
    return NextResponse.json({ error: "Invalid classroom" }, { status: 400 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  const { supabase, user } = ctx;
  const { data: classroom } = await supabase
    .from("classrooms")
    .select("id, name, join_code")
    .eq("id", classroomId)
    .eq("teacher_id", user.id)
    .maybeSingle();

  if (!classroom?.join_code?.trim()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  const { data: recipient } = await admin
    .from("classroom_invite_recipients")
    .select("id, linked_user_id")
    .eq("classroom_id", classroomId)
    .eq("email", email)
    .maybeSingle();

  if (!recipient) {
    return NextResponse.json({ error: "Student not on invite list" }, { status: 404 });
  }

  if (recipient.linked_user_id) {
    return NextResponse.json({ error: "Student already joined — no invite email needed" }, { status: 400 });
  }

  const { data: teacher } = await admin
    .from("profiles")
    .select("name, first_name, last_name")
    .eq("id", user.id)
    .maybeSingle();

  const teacherName =
    [teacher?.first_name, teacher?.last_name].filter(Boolean).join(" ").trim() ||
    teacher?.name?.trim() ||
    "Your teacher";

  const invite = buildClassroomInviteEmail({
    studentEmail: email,
    teacherName,
    classroomName: classroom.name?.trim() || "Class",
    joinCode: classroom.join_code,
  });

  const result = await sendEmail({
    to: email,
    subject: invite.subject,
    html: invite.html,
    text: invite.text,
    log: { kind: "other", userId: user.id },
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error ?? "Send failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sent: true });
}
