import { PREVIEW_AUTH_PATH } from "@/lib/auth/previewAuthPath";
import { escapeHtml } from "@/lib/email/applyEmailTemplate";
import { getPortalBaseUrl } from "@/lib/email/portalBaseUrl";
import { wrapTransactionalEmailBody } from "@/lib/email/waitlistEmailTemplate";

export type ApprovalInviteEmailParams = {
  firstName: string;
  email: string;
  role: "student" | "teacher";
  customMessage?: string;
};

export function buildApprovalInviteEmail(params: ApprovalInviteEmailParams): {
  subject: string;
  html: string;
  text: string;
  signupUrl: string;
} {
  const siteUrl = getPortalBaseUrl();
  const signinUrl = `${siteUrl}${PREVIEW_AUTH_PATH}?mode=signin&role=${params.role}`;
  const roleLabel = params.role === "student" ? "Student" : "Teacher";
  const name = params.firstName.trim() || "there";
  const email = params.email.toLowerCase().trim();

  const customBlock = params.customMessage
    ? `<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#9BA3B8;background-color:#171425;border:1px solid #534AB7;border-radius:12px;padding:14px 16px;font-style:italic;">${escapeHtml(params.customMessage)}</p>`
    : "";

  const bodyHtml = `
    <h2 style="color:#1D9E75;margin:0 0 16px;font-size:20px;font-weight:700;text-align:center;">You're approved for early access!</h2>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#9BA3B8;">Hi ${escapeHtml(name)},</p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#9BA3B8;">Your EduBlast waitlist application has been approved. You can sign in now and complete onboarding as a <strong style="color:#E8EAF0;">${escapeHtml(roleLabel)}</strong>.</p>
    <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#9BA3B8;">Use this exact Google account: <strong style="color:#E8EAF0;">${escapeHtml(email)}</strong></p>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#9BA3B8;">A different email will be blocked. Check spam/promotions if you don't see this message in your inbox.</p>
    ${customBlock}
    <div style="text-align:center;margin:24px 0;">
      <a href="${escapeHtml(signinUrl)}" style="background-color:#1D9E75;color:#ffffff;padding:12px 28px;text-decoration:none;border-radius:999px;font-weight:600;font-size:14px;display:inline-block;">Sign in and get access</a>
    </div>
    <p style="margin:0;font-size:13px;line-height:1.6;color:#5C6480;text-align:center;">Or copy this link:<br/><a href="${escapeHtml(signinUrl)}" style="color:#1D9E75;word-break:break-all;">${escapeHtml(signinUrl)}</a></p>
  `;

  const text = [
    `Hi ${name},`,
    "",
    "Your EduBlast waitlist application has been approved for early access.",
    `Sign in as: ${email}`,
    `Role: ${roleLabel}`,
    "",
    params.customMessage ? params.customMessage : "",
    params.customMessage ? "" : "",
    `Sign in here: ${signinUrl}`,
    "",
    "Use the same Google account listed above. Check spam if you don't see this email.",
    "",
    "Contact join@edublast.in if you did not apply.",
    "",
    "— EduBlast",
  ]
    .filter((line, i, arr) => !(line === "" && arr[i + 1] === ""))
    .join("\n");

  return {
    subject: `EduBlast early access approved — sign in now (${email})`,
    html: wrapTransactionalEmailBody(bodyHtml),
    text,
    signupUrl: signinUrl,
  };
}
