import "server-only";

import { sendEmail } from "@/lib/email/emailService";
import {
  buildAmbassadorApplicationEmail,
  buildWaitlistConfirmationEmail,
} from "@/lib/email/waitlistEmailTemplate";

/** Send Step 1 waitlist confirmation. Does not throw; logs failures. */
export async function sendWaitlistConfirmationEmail(
  waitlistId: string,
  email: string,
  phone: string
): Promise<boolean> {
  const { subject, html, text } = buildWaitlistConfirmationEmail({ waitlistId, email, phone });
  const result = await sendEmail({
    to: email,
    subject,
    html,
    text,
    log: { kind: "other" },
  });
  if (!result.success) {
    console.error(
      "[waitlist email] Step 1 confirmation failed:",
      result.error,
      { waitlistId, email }
    );
    return false;
  }
  return true;
}

/** Send Step 2 ambassador / full application receipt. Does not throw; logs failures. */
export async function sendAmbassadorApplicationEmail(params: {
  waitlistId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: "student" | "teacher" | "parent" | "other";
}): Promise<boolean> {
  const { subject, html, text } = buildAmbassadorApplicationEmail(params);
  const result = await sendEmail({
    to: params.email,
    subject,
    html,
    text,
    log: { kind: "other" },
  });
  if (!result.success) {
    console.error(
      "[waitlist email] Step 2 application receipt failed:",
      result.error,
      { waitlistId: params.waitlistId, email: params.email }
    );
    return false;
  }
  return true;
}
