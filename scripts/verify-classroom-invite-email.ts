/**
 * Verify classroom invite email SMTP (same template + transport as production).
 * Usage: npx tsx --env-file=.env scripts/verify-classroom-invite-email.ts
 */
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";
import { buildClassroomInviteEmail } from "../lib/email/classroomInviteEmail";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const host = process.env.EMAIL_SERVER_HOST?.trim();
  const port = Number(process.env.EMAIL_SERVER_PORT);
  const user = process.env.EMAIL_SERVER_USER?.trim();
  const pass = (process.env.EMAIL_SERVER_PASSWORD || "").replace(/\s+/g, "");

  if (!url || !key) {
    console.error("Missing Supabase env");
    process.exit(1);
  }
  if (!host || !port || !user || !pass) {
    console.error("Missing EMAIL_SERVER_* env");
    process.exit(1);
  }

  const admin = createClient(url, key);
  const { data: batch } = await admin
    .from("classroom_invite_batches")
    .select("id, classroom_id, teacher_id, invited_count, created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!batch) {
    console.error("No invite batch found");
    process.exit(1);
  }

  const [{ data: classroom }, { data: teacher }, { data: recipients }] = await Promise.all([
    admin.from("classrooms").select("name, join_code").eq("id", batch.classroom_id).maybeSingle(),
    admin.from("profiles").select("name, first_name, last_name").eq("id", batch.teacher_id).maybeSingle(),
    admin
      .from("classroom_invite_recipients")
      .select("email")
      .eq("batch_id", batch.id),
  ]);

  const email = recipients?.[0]?.email;
  if (!email || !classroom?.join_code) {
    console.error("No recipient or join code on latest batch");
    process.exit(1);
  }

  const teacherName =
    [teacher?.first_name, teacher?.last_name].filter(Boolean).join(" ").trim() ||
    teacher?.name?.trim() ||
    "Your teacher";

  const invite = buildClassroomInviteEmail({
    studentEmail: email,
    teacherName,
    classroomName: classroom.name ?? "Class",
    joinCode: classroom.join_code,
  });

  console.log("Sending to:", email);
  console.log("Subject:", invite.subject);

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  const info = await transporter.sendMail({
    from: `"EduBlast" <${user}>`,
    to: email,
    subject: invite.subject,
    html: invite.html,
    text: invite.text,
  });

  console.log("SMTP result messageId:", info.messageId);
  console.log("accepted:", info.accepted);
  console.log("rejected:", info.rejected);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
