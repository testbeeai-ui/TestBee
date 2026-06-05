export type LoginNotificationTemplateParams = {
  studentName: string;
  loginAtLabel: string;
  portalName?: string;
};

export function buildStudentLoginNotificationEmail(
  params: LoginNotificationTemplateParams
): { subject: string; html: string } {
  const portal = params.portalName?.trim() || "Testbee";
  const name = params.studentName.trim() || "Student";

  const subject = `Successful sign-in to ${portal}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6fb;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f6fb;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,0.08);">
          <tr>
            <td style="padding:28px 32px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#ffffff;">
              <p style="margin:0;font-size:13px;letter-spacing:0.04em;text-transform:uppercase;opacity:0.9;">${portal}</p>
              <h1 style="margin:8px 0 0;font-size:22px;font-weight:700;line-height:1.3;">Welcome back!</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px;">
              <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Hi <strong>${escapeHtml(name)}</strong>,</p>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
                This confirms you have successfully signed in to your ${escapeHtml(portal)} student account.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
                <tr>
                  <td style="padding:16px 18px;">
                    <p style="margin:0 0 6px;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Login date &amp; time (IST)</p>
                    <p style="margin:0;font-size:15px;font-weight:600;color:#0f172a;">${escapeHtml(params.loginAtLabel)}</p>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:14px;line-height:1.6;color:#475569;">
                If this was not you, please secure your account immediately and contact our support team.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 32px 28px;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;">
                This is an automated message from ${escapeHtml(portal)}. Please do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
