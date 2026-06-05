import { applyEmailTemplate } from "@/lib/email/applyEmailTemplate";
import { NEW_USER_WELCOME_HTML_TEMPLATE } from "@/lib/email/templates/newUserWelcome.html";

/** Same asset as auth/onboarding header (`public/images/logo-2.png`). */
export const EDUBLAST_EMAIL_LOGO_PATH = "/images/logo-2.png";

export type NewUserWelcomeTemplateParams = {
  displayName: string;
  role: "student" | "teacher" | string;
  portalName?: string;
  portalBaseUrl: string;
};

const TEACHER_WELCOME_HTML = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Welcome to Edublast</title></head>
<body style="margin:0;padding:0;background-color:#0b0f19;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#0b0f19;padding:40px 16px;"><tr><td align="center">
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;background-color:#131a26;border-radius:16px;border:1px solid #222f43;">
<tr><td height="4" style="background:linear-gradient(90deg,#3b82f6,#10b981);font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td align="center" style="padding:32px 40px 20px;"><a href="{{dashboardUrl}}" target="_blank" style="text-decoration:none;"><img src="{{logoUrl}}" alt="Edublast" width="220" style="display:block;margin:0 auto;width:220px;max-width:100%;height:auto;border:0;outline:none;" /></a></td></tr>
<tr><td style="padding:16px 40px 32px;">
<h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#fff;text-align:center;">Your teacher account is active</h1>
<p style="margin:0 0 24px;font-size:14px;color:#cbd5e1;text-align:center;">Hi {{displayName}},</p>
<p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:#94a3b8;text-align:center;">Welcome to Edublast. Open your classroom hub to manage classes and share content with students.</p>
<table border="0" cellpadding="0" cellspacing="0" width="100%"><tr><td align="center">
<a href="{{dashboardUrl}}" target="_blank" style="display:inline-block;background-color:#3b82f6;color:#fff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:8px;">Open classroom hub</a>
</td></tr></table>
</td></tr>
<tr><td style="padding:24px 40px;background-color:#0f172a;border-top:1px solid #222f43;">
<p style="margin:0;font-size:12px;color:#475569;font-weight:600;">&copy; {{year}} Edublast Platforms.</p>
</td></tr>
</table></td></tr></table>
</body></html>`;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildPlainTextWelcome(params: {
  displayName: string;
  isTeacher: boolean;
  dashboardUrl: string;
}): string {
  const { displayName, isTeacher, dashboardUrl } = params;
  if (isTeacher) {
    return [
      `Hi ${displayName},`,
      "",
      "Your Edublast teacher account is active.",
      "",
      `Open your classroom hub: ${dashboardUrl}`,
      "",
      "— Edublast",
    ].join("\n");
  }
  return [
    `Hi ${displayName},`,
    "",
    "Welcome to Edublast. Your 14-day premium testing trial has been unlocked.",
    "",
    "Current tier: 14-Day Free Trial (Active Now)",
    "",
    "Unlock Challenge — The 44-Day Streak Bonus:",
    "Maintain your daily activity streak for 44 consecutive days after sign-up to unlock a 1-month premium bonus extension.",
    "If the streak breaks, your 14-day trial continues but the bonus extension is forfeited.",
    "",
    `Initialize your daily streak: ${dashboardUrl}`,
    "",
    "— Edublast",
  ].join("\n");
}

export function buildNewUserWelcomeEmail(
  params: NewUserWelcomeTemplateParams
): { subject: string; html: string; text: string } {
  const name = params.displayName.trim() || "there";
  const base = params.portalBaseUrl.replace(/\/$/, "");
  const isTeacher = params.role === "teacher";
  const dashboardPath = isTeacher ? "/teacher-portal/classrooms" : "/home";
  const dashboardUrl = `${base}${dashboardPath}`;
  const logoUrl = `${base}${EDUBLAST_EMAIL_LOGO_PATH}`;
  const year = String(new Date().getFullYear());

  const subject = isTeacher
    ? "Welcome to Edublast — your teacher account is active"
    : "Welcome to Edublast — your account is active!";

  const template = isTeacher ? TEACHER_WELCOME_HTML : NEW_USER_WELCOME_HTML_TEMPLATE;
  const html = applyEmailTemplate(template, {
    displayName: escapeHtml(name),
    dashboardUrl: escapeHtml(dashboardUrl),
    logoUrl: escapeHtml(logoUrl),
    year: escapeHtml(year),
  });

  const text = buildPlainTextWelcome({
    displayName: name,
    isTeacher,
    dashboardUrl,
  });

  return { subject, html, text };
}
