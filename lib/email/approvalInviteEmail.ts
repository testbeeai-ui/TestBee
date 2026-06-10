import { PREVIEW_AUTH_PATH } from "@/lib/auth/previewAuthPath";
import { getPortalBaseUrl } from "@/lib/email/portalBaseUrl";

export type ApprovalInviteEmailParams = {
  firstName: string;
  email: string;
  role: "student" | "teacher";
  customMessage?: string;
};

export function buildApprovalInviteEmail(params: ApprovalInviteEmailParams): {
  subject: string;
  html: string;
  signupUrl: string;
} {
  const siteUrl = getPortalBaseUrl();
  const signinUrl = `${siteUrl}${PREVIEW_AUTH_PATH}?mode=signin&role=${params.role}`;
  const roleLabel = params.role === "student" ? "Student" : "Teacher";
  const customBlock = params.customMessage
    ? `<div style="background-color: #f3f4f6; border-left: 4px solid #1D9E75; padding: 12px 16px; margin: 20px 0; border-radius: 8px; font-style: italic;">"${params.customMessage}"</div>`
    : "";

  const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1f2937; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 16px; background-color: #ffffff; overflow: hidden; line-height: 1.6;">
        <div style="background-color: #161b27; padding: 24px; text-align: center;">
          <img src="${siteUrl}/images/logo-2.png" alt="EduBlast" height="36" style="height: 36px; width: auto; max-width: 100%; border: 0; display: block; margin: 0 auto;" />
        </div>
        <div style="padding: 28px;">
          <h2 style="color: #1D9E75; margin-top: 0; font-size: 20px; font-weight: 700; text-align: center; margin-bottom: 20px;">Welcome to EduBlast early access!</h2>
          <p>Hello ${params.firstName},</p>
          <p>Your waitlist application has been approved for early access.</p>
          <p>Sign in with this exact Google account: <a href="mailto:${params.email}" style="color: #1D9E75; text-decoration: none; font-weight: 600;">${params.email}</a></p>
          <p>Complete onboarding as a <strong>${roleLabel}</strong>. Using a different email will be blocked.</p>
          ${customBlock}
          <div style="margin: 28px 0; text-align: center;">
            <a href="${signinUrl}" style="background-color: #1D9E75; color: white; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; box-shadow: 0 4px 6px -1px rgba(29, 158, 117, 0.2);">
              Sign in and get access
            </a>
          </div>
          <p style="font-size: 13px; color: #6b7280;">Or open <a href="${signinUrl}" style="color: #1D9E75;">${signinUrl}</a></p>
          <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="font-size: 12px; color: #6b7280; text-align: center;">If you did not apply for the waitlist, please reply to this email.</p>
        </div>
      </div>
    `;

  return {
    subject: "Your EduBlast waitlist application is approved — sign in to continue",
    html,
    signupUrl: signinUrl,
  };
}
