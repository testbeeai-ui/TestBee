import "server-only";

import { buildApprovalInviteEmail } from "@/lib/email/approvalInviteEmail";
import { sendEmail, type SendEmailResult } from "@/lib/email/emailService";

export type SendApprovalInviteInput = {
  firstName: string;
  email: string;
  role: "student" | "teacher";
  customMessage?: string;
  adminUserId?: string | null;
};

export async function sendApprovalInviteEmail(
  input: SendApprovalInviteInput
): Promise<SendEmailResult & { signupUrl?: string }> {
  const cleanEmail = input.email.toLowerCase().trim();
  const invite = buildApprovalInviteEmail({
    firstName: input.firstName.trim() || "there",
    email: cleanEmail,
    role: input.role,
    customMessage: input.customMessage,
  });

  const result = await sendEmail({
    to: cleanEmail,
    subject: invite.subject,
    html: invite.html,
    text: invite.text,
    log: {
      kind: "approval",
      userId: input.adminUserId ?? null,
    },
  });

  if (result.success) {
    return { ...result, signupUrl: invite.signupUrl };
  }
  return result;
}
