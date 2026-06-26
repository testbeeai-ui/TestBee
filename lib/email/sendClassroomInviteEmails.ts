import "server-only";

import { createAdminClient } from "@/integrations/supabase/server";
import { buildClassroomInviteEmail } from "@/lib/email/classroomInviteEmail";
import { isEmailConfigured, sendEmail } from "@/lib/email/emailService";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const SEND_CONCURRENCY = 6;

export type SendClassroomInviteEmailsInput = {
  classroomId: string;
  batchId: string;
  teacherUserId: string;
};

export type SendClassroomInviteEmailsResult = {
  attempted: number;
  sent: number;
  skippedAlreadyJoined: number;
  skippedNotInBatch: number;
  failed: number;
  emailConfigured: boolean;
};

async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const i = index++;
      await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
}

async function loadMemberEmails(admin: NonNullable<ReturnType<typeof createAdminClient>>, classroomId: string) {
  const memberEmails = new Set<string>();

  const { data: members } = await admin
    .from("classroom_members")
    .select("user_id, role")
    .eq("classroom_id", classroomId);

  const studentIds = (members ?? [])
    .filter((m) => m.role !== "teacher")
    .map((m) => m.user_id);

  for (const userId of studentIds) {
    const { data: authData } = await admin.auth.admin.getUserById(userId);
    const email = authData.user?.email?.trim().toLowerCase();
    if (email && EMAIL_RE.test(email)) memberEmails.add(email);
  }

  const { data: linkedRows } = await admin
    .from("classroom_invite_recipients")
    .select("email")
    .eq("classroom_id", classroomId)
    .not("linked_user_id", "is", null);

  for (const row of linkedRows ?? []) {
    const email = row.email?.trim().toLowerCase();
    if (email) memberEmails.add(email);
  }

  return memberEmails;
}

function teacherDisplayName(profile: {
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}): string {
  const first = profile.first_name?.trim() ?? "";
  const last = profile.last_name?.trim() ?? "";
  const combined = `${first} ${last}`.trim();
  return combined || profile.name?.trim() || "Your teacher";
}

/**
 * Sends invitation emails for rows created in a bulk-invite batch.
 * Skips students already in the class or already linked on a prior invite.
 */
export async function sendClassroomInviteEmails(
  input: SendClassroomInviteEmailsInput,
): Promise<SendClassroomInviteEmailsResult> {
  const result: SendClassroomInviteEmailsResult = {
    attempted: 0,
    sent: 0,
    skippedAlreadyJoined: 0,
    skippedNotInBatch: 0,
    failed: 0,
    emailConfigured: isEmailConfigured(),
  };

  if (!result.emailConfigured) {
    return result;
  }

  const admin = createAdminClient();
  if (!admin) return result;

  const [{ data: classroom }, { data: teacher }, { data: batchRows }] = await Promise.all([
    admin
      .from("classrooms")
      .select("id, name, join_code, teacher_id")
      .eq("id", input.classroomId)
      .maybeSingle(),
    admin
      .from("profiles")
      .select("name, first_name, last_name")
      .eq("id", input.teacherUserId)
      .maybeSingle(),
    admin
      .from("classroom_invite_recipients")
      .select("email")
      .eq("batch_id", input.batchId)
      .eq("classroom_id", input.classroomId),
  ]);

  if (!classroom?.join_code?.trim()) {
    return result;
  }

  const batchEmails = [...new Set((batchRows ?? []).map((r) => r.email.trim().toLowerCase()))];
  if (batchEmails.length === 0) {
    result.skippedNotInBatch = 0;
    return result;
  }

  const memberEmails = await loadMemberEmails(admin, input.classroomId);
  const teacherName = teacherDisplayName(teacher ?? {});
  const classroomName = classroom.name?.trim() || "Class";

  const toSend = batchEmails.filter((email) => {
    if (memberEmails.has(email)) {
      result.skippedAlreadyJoined += 1;
      return false;
    }
    return true;
  });

  result.attempted = toSend.length;

  await mapWithConcurrency(toSend, SEND_CONCURRENCY, async (email) => {
    const invite = buildClassroomInviteEmail({
      studentEmail: email,
      teacherName,
      classroomName,
      joinCode: classroom.join_code!,
    });

    const sendResult = await sendEmail({
      to: email,
      subject: invite.subject,
      html: invite.html,
      text: invite.text,
      log: {
        kind: "other",
        userId: input.teacherUserId,
      },
    });

    if (sendResult.success) {
      result.sent += 1;
    } else {
      result.failed += 1;
      console.warn("[classroomInviteEmail] send failed", email, sendResult.error);
    }
  });

  return result;
}
