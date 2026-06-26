import { escapeHtml } from "@/lib/email/applyEmailTemplate";
import { getPortalBaseUrl } from "@/lib/email/portalBaseUrl";
import { wrapTransactionalEmailBody } from "@/lib/email/waitlistEmailTemplate";

export type ClassroomInviteEmailParams = {
  studentEmail: string;
  teacherName: string;
  classroomName: string;
  joinCode: string;
};

export function buildClassroomInviteEmail(params: ClassroomInviteEmailParams): {
  subject: string;
  html: string;
  text: string;
  joinUrl: string;
} {
  const siteUrl = getPortalBaseUrl();
  const joinUrl = `${siteUrl}/join?code=${encodeURIComponent(params.joinCode.trim())}`;
  const email = params.studentEmail.toLowerCase().trim();
  const teacher = params.teacherName.trim() || "Your teacher";
  const classroom = params.classroomName.trim() || "your class";

  const bodyHtml = `
    <h2 style="color:#1D9E75;margin:0 0 16px;font-size:20px;font-weight:700;text-align:center;">You're invited to join a class</h2>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#9BA3B8;">Hi,</p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#9BA3B8;">
      <strong style="color:#E8EAF0;">${escapeHtml(teacher)}</strong> has invited you to join
      <strong style="color:#E8EAF0;">${escapeHtml(classroom)}</strong> on EduBlast.
    </p>
    <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#9BA3B8;">
      Sign up or sign in with this email address: <strong style="color:#E8EAF0;">${escapeHtml(email)}</strong>
    </p>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#9BA3B8;">
      After you join, you'll get access to class assignments, live sessions, and study tools on EduBlast.
    </p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${escapeHtml(joinUrl)}" style="background-color:#1D9E75;color:#ffffff;padding:12px 28px;text-decoration:none;border-radius:999px;font-weight:600;font-size:14px;display:inline-block;">Accept invitation</a>
    </div>
    <p style="margin:0;font-size:13px;line-height:1.6;color:#5C6480;text-align:center;">
      Or copy this link:<br/>
      <a href="${escapeHtml(joinUrl)}" style="color:#1D9E75;word-break:break-all;">${escapeHtml(joinUrl)}</a>
    </p>
  `;

  const text = [
    `Hi,`,
    "",
    `${teacher} has invited you to join ${classroom} on EduBlast.`,
    "",
    `Sign up or sign in with: ${email}`,
    "",
    `Accept invitation: ${joinUrl}`,
    "",
    "If you did not expect this invitation, you can ignore this email.",
    "",
    "— EduBlast",
  ].join("\n");

  return {
    subject: `${teacher} invited you to ${classroom} on EduBlast`,
    html: wrapTransactionalEmailBody(bodyHtml, email),
    text,
    joinUrl,
  };
}
