/**
 * EduDeca individual-student welcome / invitation email (inline styles for clients).
 * Placeholders: {{name}}, {{ctaUrl}}, {{logoUrl}}, {{year}}
 */
export const EDUDECA_STUDENT_WELCOME_HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="dark light" />
  <title>Welcome to EduDeca</title>
</head>
<body style="margin:0;padding:0;background-color:#0E1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#0E1117;opacity:0;">
    You're registered for EduDeca — practice when you're ready, and we'll keep you posted on launch.
    &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#0E1117;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;background-color:#161B25;border-radius:16px;border:1px solid #2A3347;overflow:hidden;">
          <tr>
            <td align="center" style="background-color:#161b27;padding:28px 24px 20px;text-align:center;">
              <a href="https://www.edublast.in" target="_blank" style="text-decoration:none;">
                <img src="{{logoUrl}}" alt="EduBlast" width="140" height="36" style="height:36px;width:auto;max-width:160px;border:0;display:block;margin:0 auto;" />
              </a>
              <p style="margin:12px 0 0;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#5C6480;">
                EduDeca
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0;line-height:0;font-size:0;height:3px;background-color:#1D9E75;">
              <div style="height:3px;line-height:3px;font-size:3px;">&nbsp;</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 24px 8px;color:#E8EAF0;">
              <h1 style="margin:0 0 8px;font-size:24px;line-height:1.3;font-weight:700;color:#E8EAF0;text-align:center;">
                Welcome aboard, {{name}}
              </h1>
              <p style="margin:0 0 20px;font-size:14px;line-height:1.5;color:#22D3A6;text-align:center;font-weight:500;">
                You're registered for EduDeca
              </p>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#9BA3B8;text-align:left;">
                Thanks for signing up. EduDeca is Edublast's student competition and prep track — built to help you practice, level up, and stay ready when challenges open.
              </p>
              <p style="margin:0 0 8px;font-size:15px;line-height:1.65;color:#9BA3B8;text-align:left;">
                For now, you can explore practice when it's available, or simply hang tight — we'll email you when the next launch window arrives. No spam, just the useful stuff.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 24px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#0A2A20;border:1px solid #1D9E75;border-radius:12px;">
                <tr>
                  <td style="padding:16px 18px;">
                    <p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#9FE1CB;">
                      What's next
                    </p>
                    <p style="margin:0;font-size:14px;line-height:1.55;color:#9BA3B8;">
                      Open EduDeca to continue where you left off — practice when you're ready, and keep an eye on your inbox for launch updates.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:28px 24px 12px;">
              <a href="{{ctaUrl}}" target="_blank" style="background-color:#1D9E75;color:#ffffff;padding:14px 32px;text-decoration:none;border-radius:999px;font-weight:600;font-size:15px;display:inline-block;line-height:1.2;">
                Continue to EduDeca
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 24px 32px;">
              <p style="margin:0;font-size:12px;line-height:1.55;color:#5C6480;text-align:center;">
                Button not working? Paste this link into your browser:<br />
                <a href="{{ctaUrl}}" target="_blank" style="color:#22D3A6;word-break:break-all;text-decoration:underline;">{{ctaUrl}}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 24px 24px;background-color:#0f1419;border-top:1px solid #2A3347;">
              <p style="margin:0 0 8px;font-size:12px;line-height:1.5;color:#5C6480;text-align:center;">
                EduDeca is part of <strong style="color:#9BA3B8;font-weight:600;">EduBlast</strong>
              </p>
              <p style="margin:0;font-size:12px;color:#5C6480;text-align:center;">
                Questions? <a href="mailto:join@edublast.in" style="color:#1D9E75;text-decoration:none;">join@edublast.in</a>
              </p>
              <p style="margin:10px 0 0;font-size:11px;color:#5C6480;text-align:center;">
                &copy; {{year}} EduBlast · <a href="https://www.edublast.in" style="color:#5C6480;text-decoration:none;">edublast.in</a>
              </p>
              <p style="margin:12px 0 0;font-size:10px;line-height:1.4;color:#4B526D;text-align:center;">
                You received this because you registered interest in EduDeca. If that wasn't you, you can ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
