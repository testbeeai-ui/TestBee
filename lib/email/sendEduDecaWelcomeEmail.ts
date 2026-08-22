import "server-only";

import { isEmailConfigured, sendEmail } from "@/lib/email/emailService";
import { buildEduDecaStudentWelcomeEmail } from "@/lib/email/edudecaWelcomeEmailTemplate";
import { EDUBLAST_PUBLIC_ORIGIN } from "@/lib/email/portalBaseUrl";

/** Canonical EduDeca product URL — never edublast.in/edudeca in student mail. */
export const EDUDECA_PUBLIC_ORIGIN = "https://edu-deca.vercel.app";

function resolveEduDecaWelcomeCtaUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_EDUDECA_APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return EDUDECA_PUBLIC_ORIGIN;
}

/**
 * Welcome / invitation email after an individual student registers for EduDeca.
 * Does not throw — logs and returns false on failure so registration still succeeds.
 */
export async function sendEduDecaStudentWelcomeEmail(params: {
  email: string;
  displayName?: string;
  userId?: string | null;
}): Promise<boolean> {
  if (!isEmailConfigured()) {
    console.warn("[edudeca welcome] Email not configured — skipping send");
    return false;
  }

  const { subject, html, text } = buildEduDecaStudentWelcomeEmail({
    email: params.email,
    displayName: params.displayName,
    ctaUrl: resolveEduDecaWelcomeCtaUrl(),
    logoBaseUrl: EDUBLAST_PUBLIC_ORIGIN,
  });

  const result = await sendEmail({
    to: params.email,
    subject,
    html,
    text,
    log: { kind: "welcome", userId: params.userId ?? null },
  });

  if (!result.success) {
    console.error("[edudeca welcome] send failed:", result.error, { email: params.email });
    return false;
  }
  return true;
}
