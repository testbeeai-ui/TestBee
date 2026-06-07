import { applyEmailTemplate, escapeHtml } from "@/lib/email/applyEmailTemplate";
import { EDUBLAST_EMAIL_LOGO_PATH } from "@/lib/email/newUserWelcomeTemplate";
import { getPortalBaseUrl } from "@/lib/email/portalBaseUrl";


const EMAIL_SHELL = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0E1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#0E1117;padding:32px 16px;"><tr><td align="center">
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;background-color:#161B25;border-radius:16px;border:1px solid #2A3347;overflow:hidden;">
<tr><td style="background-color:#161b27;padding:24px;text-align:center;">
<img src="{{logoUrl}}" alt="EduBlast" height="36" style="height:36px;width:auto;max-width:100%;border:0;display:block;margin:0 auto;" />
</td></tr>
<tr><td style="padding:28px 32px;color:#E8EAF0;">{{bodyHtml}}</td></tr>
<tr><td style="padding:20px 32px;background-color:#0f1419;border-top:1px solid #2A3347;">
<p style="margin:0;font-size:12px;color:#5C6480;text-align:center;">&copy; {{year}} EduBlast. You joined the waitlist at {{siteUrl}}</p>
</td></tr>
</table></td></tr></table>
</body></html>`;

function wrapEmailBody(bodyHtml: string): string {
  const base = getPortalBaseUrl().replace(/\/$/, "");
  return applyEmailTemplate(EMAIL_SHELL, {
    logoUrl: escapeHtml(`${base}${EDUBLAST_EMAIL_LOGO_PATH}`),
    bodyHtml,
    year: escapeHtml(String(new Date().getFullYear())),
    siteUrl: escapeHtml(base),
  });
}

export type WaitlistConfirmationEmailParams = {
  waitlistId: string;
  email: string;
};

export function buildWaitlistConfirmationEmail(params: WaitlistConfirmationEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const { waitlistId, email } = params;
  const base = getPortalBaseUrl().replace(/\/$/, "");
  const waitlistUrl = `${base}/waitlist#ambassador`;

  const bodyHtml = `
    <h2 style="color:#1D9E75;margin:0 0 16px;font-size:20px;font-weight:700;text-align:center;">You're on the waitlist!</h2>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#9BA3B8;">Thanks for signing up for early access to EduBlast — India's learning social network for PUC PCM students.</p>
    <div style="background-color:#0A2A20;border:1px solid #1D9E75;border-radius:12px;padding:16px;margin:20px 0;text-align:center;">
      <p style="margin:0 0 4px;font-size:11px;color:#9FE1CB;text-transform:uppercase;letter-spacing:0.05em;">Your waitlist ID</p>
      <p style="margin:0;font-size:18px;font-weight:700;color:#1D9E75;font-family:ui-monospace,monospace;">${escapeHtml(waitlistId)}</p>
    </div>
    <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#9BA3B8;">We registered <strong style="color:#E8EAF0;">${escapeHtml(email)}</strong>. We'll email you again when we're ready to open early preview access across India.</p>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#9BA3B8;">Want early preview access and a paid Ambassador role? Complete the optional ambassador application on the waitlist page.</p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${escapeHtml(waitlistUrl)}" style="background-color:#1D9E75;color:#ffffff;padding:12px 28px;text-decoration:none;border-radius:999px;font-weight:600;font-size:14px;display:inline-block;">Apply as Ambassador (optional)</a>
    </div>
    <p style="margin:0;font-size:12px;color:#5C6480;text-align:center;">No spam. Reply to this email if you have questions.</p>
  `;

  const text = [
    "You're on the EduBlast waitlist!",
    "",
    `Waitlist ID: ${waitlistId}`,
    `Registered email: ${email}`,
    "",
    "We'll contact you when early preview access opens.",
    "",
    `Optional ambassador application: ${waitlistUrl}`,
    "",
    "— EduBlast",
  ].join("\n");

  return {
    subject: `You're on the EduBlast waitlist (${waitlistId})`,
    html: wrapEmailBody(bodyHtml),
    text,
  };
}

export type AmbassadorApplicationEmailParams = {
  waitlistId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: "student" | "teacher" | "parent" | "other";
};

const ROLE_LABELS: Record<AmbassadorApplicationEmailParams["role"], string> = {
  student: "Student",
  teacher: "Teacher / Tutor",
  parent: "Parent / Guardian",
  other: "Other",
};

export function buildAmbassadorApplicationEmail(params: AmbassadorApplicationEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const { waitlistId, firstName, lastName, email, role } = params;
  const name = [firstName, lastName].filter(Boolean).join(" ").trim() || "there";
  const roleLabel = ROLE_LABELS[role];
  const isAmbassadorRole = role === "student" || role === "teacher";

  const ambassadorBlock = isAmbassadorRole
    ? `<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#AFA9EC;background-color:#171425;border:1px solid #534AB7;border-radius:12px;padding:14px 16px;">Your application is flagged for <strong>${escapeHtml(roleLabel)} Ambassador</strong> consideration. We will call your registered mobile within 3 business days to verify your details.</p>`
    : "";

  const bodyHtml = `
    <h2 style="color:#1D9E75;margin:0 0 16px;font-size:20px;font-weight:700;text-align:center;">Application received</h2>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#9BA3B8;">Hi ${escapeHtml(name)},</p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#9BA3B8;">We've received your ${escapeHtml(roleLabel)} waitlist details on EduBlast.</p>
    <div style="background-color:#281C08;border:1px solid #EF9F27;border-radius:12px;padding:14px 16px;margin:16px 0;text-align:center;">
      <p style="margin:0;font-size:13px;color:#FAC775;font-family:ui-monospace,monospace;">Waitlist ID: ${escapeHtml(waitlistId)}</p>
    </div>
    ${ambassadorBlock}
    <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#9BA3B8;">Registered email: <strong style="color:#E8EAF0;">${escapeHtml(email)}</strong></p>
    <p style="margin:0;font-size:12px;color:#5C6480;">Keep an eye on your phone and inbox — the EduBlast team will be in touch as we approach launch.</p>
  `;

  const text = [
    `Hi ${name},`,
    "",
    `Your EduBlast waitlist application was received (${roleLabel}).`,
    `Waitlist ID: ${waitlistId}`,
    "",
    isAmbassadorRole
      ? "Your application is flagged for Ambassador consideration. Expect a verification call within 3 business days."
      : "We'll be in touch as we approach launch.",
    "",
    "— EduBlast",
  ].join("\n");

  return {
    subject: isAmbassadorRole
      ? `Ambassador application received — ${waitlistId}`
      : `Waitlist application received — ${waitlistId}`,
    html: wrapEmailBody(bodyHtml),
    text,
  };
}
