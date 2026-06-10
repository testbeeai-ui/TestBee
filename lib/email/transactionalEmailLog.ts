import "server-only";

import { createAdminClient } from "@/integrations/supabase/server";
import { getEmailDailySendCap } from "@/lib/email/emailDailyCap";
import { getIstCalendarDateIso } from "@/lib/subscription/subjectChatLimits";

export type TransactionalEmailKind = "welcome" | "login" | "approval" | "other";
export type TransactionalEmailStatus = "sent" | "failed" | "blocked_cap";

export type LogTransactionalEmailInput = {
  kind: TransactionalEmailKind;
  recipient: string;
  subject: string;
  status: TransactionalEmailStatus;
  userId?: string | null;
  messageId?: string | null;
  errorMessage?: string | null;
  nowMs?: number;
};

export { getEmailDailySendCap };

export async function countSentEmailsForIstDate(istDate: string): Promise<number> {
  const admin = createAdminClient();
  if (!admin) return 0;

  const { count, error } = await admin
    .from("transactional_email_logs")
    .select("id", { count: "exact", head: true })
    .eq("ist_date", istDate)
    .eq("status", "sent");

  if (error) {
    console.warn("[transactionalEmailLog] count failed:", error.message);
    return 0;
  }
  return count ?? 0;
}

/** Returns null if under cap, or an error message when the IST-day cap is reached. */
export async function checkEmailDailyCap(nowMs = Date.now()): Promise<string | null> {
  const cap = getEmailDailySendCap();
  const istDate = getIstCalendarDateIso(nowMs);
  const sent = await countSentEmailsForIstDate(istDate);
  if (sent >= cap) {
    return `Daily email cap reached (${sent}/${cap} sent today IST).`;
  }
  return null;
}

export async function logTransactionalEmail(input: LogTransactionalEmailInput): Promise<void> {
  const admin = createAdminClient();
  if (!admin) {
    console.warn("[transactionalEmailLog] admin client missing — skip log");
    return;
  }

  const istDate = getIstCalendarDateIso(input.nowMs ?? Date.now());
  const { error } = await admin.from("transactional_email_logs").insert({
    ist_date: istDate,
    kind: input.kind,
    recipient: input.recipient.trim(),
    user_id: input.userId ?? null,
    subject: input.subject.trim(),
    status: input.status,
    message_id: input.messageId ?? null,
    error_message: input.errorMessage ?? null,
  });

  if (error) {
    console.warn("[transactionalEmailLog] insert failed:", error.message);
  }
}
