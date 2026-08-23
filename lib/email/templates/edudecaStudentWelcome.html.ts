/**
 * EduDeca individual-student welcome / invitation email (inline styles for clients).
 * Design: dark card, EduBlast logo, Levels 1–2 wait messaging, EduBite promo (no QR).
 * Placeholders: {{name}}, {{ctaUrl}}, {{logoUrl}}, {{year}}, {{edubiteUrl}}
 */
export const EDUDECA_STUDENT_WELCOME_HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="dark" />
  <title>Welcome to EduDeca</title>
  <style type="text/css">
    body { margin: 0; padding: 0; background: #05070a; -webkit-text-size-adjust: 100%; }
    table { border-collapse: collapse; }
    a { text-decoration: none; }
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; max-width: 100% !important; }
      .pad { padding-left: 24px !important; padding-right: 24px !important; }
      .cta-btn { padding: 14px 28px !important; font-size: 14px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#05070a;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#05070a;opacity:0;">
    You're registered for EduDeca — we'll email you when Levels 1–2 open.
    &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#05070a;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:#12161D;border-radius:18px;overflow:hidden;border:1px solid #232B36;">

          <!-- EduBlast logo -->
          <tr>
            <td class="pad" align="center" style="padding:36px 40px 8px;">
              <a href="{{ctaUrl}}" target="_blank" style="text-decoration:none;">
                <img src="{{logoUrl}}" width="150" alt="EduBlast" style="display:block;height:auto;max-width:150px;width:150px;border:0;outline:none;" />
              </a>
            </td>
          </tr>

          <!-- Heading -->
          <tr>
            <td class="pad" align="center" style="padding:20px 40px 4px;">
              <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:26px;line-height:32px;font-weight:800;color:#FFFFFF;">
                Welcome aboard, {{name}}
              </div>
            </td>
          </tr>
          <tr>
            <td class="pad" align="center" style="padding:6px 40px 28px;">
              <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:15px;font-weight:700;color:#22D3A6;">
                You're registered for EduDeca
              </div>
            </td>
          </tr>

          <!-- Body copy -->
          <tr>
            <td class="pad" style="padding:0 40px;">
              <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:15px;line-height:25px;color:#C4CDD8;">
                Welcome to the <b style="color:#fff;">EduDeca Academic Decathlon Challenge</b>. We shall send you an email as soon as the competition window for <b style="color:#fff;">Levels 1–2</b> gets open.
              </div>
              <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:15px;line-height:25px;color:#C4CDD8;margin-top:16px;">
                Proceed to EduDeca (<a href="{{ctaUrl}}" target="_blank" style="color:#22D3A6;font-weight:700;text-decoration:none;">www.edudeca.com</a>) or contact <a href="mailto:admin@edudeca.com" style="color:#22D3A6;font-weight:700;text-decoration:none;">admin@edudeca.com</a> should you have any queries.
              </div>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td class="pad" style="padding:28px 40px 0;">
              <div style="height:1px;background:#232B36;width:100%;font-size:0;line-height:0;">&nbsp;</div>
            </td>
          </tr>

          <!-- What's next -->
          <tr>
            <td class="pad" style="padding:26px 40px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(34,211,166,0.07);border:1px solid rgba(34,211,166,0.4);border-radius:12px;">
                <tr>
                  <td style="padding:18px 22px;">
                    <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:11px;font-weight:800;letter-spacing:1px;color:#22D3A6;margin-bottom:8px;">
                      WHAT'S NEXT
                    </div>
                    <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:14px;line-height:23px;color:#C4CDD8;">
                      Keep an eye on your inbox regularly — we'll let you know the moment Levels 1–2 go live. Also, keep checking your spam folder just in case.
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- EduBite practice promo -->
          <tr>
            <td class="pad" style="padding:26px 40px 0;">
              <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:15px;line-height:25px;color:#C4CDD8;text-align:center;">
                Meanwhile, you may like to use our <b style="color:#fff;">EduBite site</b> (<a href="{{edubiteUrl}}" target="_blank" style="color:#22D3A6;font-weight:700;text-decoration:none;">www.edubite.com</a>) for building everyday consistency, along with quick daily brain workouts.
              </div>
            </td>
          </tr>
          <tr>
            <td align="center" class="pad" style="padding:18px 40px 0;">
              <a href="{{edubiteUrl}}" target="_blank" style="display:inline-block;background:#1A222C;color:#22D3A6;font-family:'Segoe UI',Arial,sans-serif;font-size:13px;font-weight:700;padding:12px 22px;border-radius:999px;border:1px solid rgba(34,211,166,0.35);text-decoration:none;">
                Open EduBite →
              </a>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td align="center" class="pad" style="padding:26px 40px 6px;">
              <a class="cta-btn" href="{{ctaUrl}}" target="_blank" style="display:inline-block;background-color:#22D3A6;background:linear-gradient(90deg,#22D3A6,#1CB58C);color:#04140E;font-family:'Segoe UI',Arial,sans-serif;font-size:15px;font-weight:800;padding:15px 40px;border-radius:30px;text-decoration:none;">
                Continue to EduDeca
              </a>
            </td>
          </tr>
          <tr>
            <td align="center" class="pad" style="padding:14px 40px 8px;">
              <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#7A8697;line-height:20px;">
                Button not working? Paste this link into your browser:<br />
                <a href="{{ctaUrl}}" target="_blank" style="color:#22D3A6;word-break:break-all;text-decoration:none;">{{ctaUrl}}</a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td class="pad" style="background:#0A0D12;padding:26px 40px;border-top:1px solid #232B36;">
              <div style="text-align:center;font-family:'Segoe UI',Arial,sans-serif;font-size:12.5px;color:#7A8697;line-height:22px;">
                EduDeca is part of <b style="color:#C4CDD8;">EduBlast</b><br />
                Questions? <a href="mailto:admin@edudeca.com" style="color:#22D3A6;text-decoration:none;">admin@edudeca.com</a><br />
                &copy; {{year}} EduBlast · edudeca.com
              </div>
              <div style="text-align:center;font-family:'Segoe UI',Arial,sans-serif;font-size:10px;color:#5A6573;line-height:16px;margin-top:12px;">
                You received this because you registered for EduDeca. If that wasn't you, you can ignore this email.
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
