/**
 * Branded welcome letter HTML (inline styles for email clients).
 * Placeholders: {{displayName}}, {{dashboardUrl}}, {{logoUrl}}, {{year}}
 */
export const NEW_USER_WELCOME_HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Edublast</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed; background-color: #0b0f19; padding: 40px 16px;">
        <tr>
            <td align="center">
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #131a26; border-radius: 16px; border: 1px solid #222f43; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.3);">
                    <tr>
                        <td height="4" style="background: linear-gradient(90deg, #3b82f6, #10b981); font-size: 0; line-height: 0;">&nbsp;</td>
                    </tr>
                    <tr>
                        <td align="center" style="padding: 32px 40px 20px 40px;">
                            <a href="{{dashboardUrl}}" target="_blank" style="text-decoration: none;">
                                <img
                                    src="{{logoUrl}}"
                                    alt="Edublast"
                                    width="220"
                                    style="display: block; margin: 0 auto; width: 220px; max-width: 100%; height: auto; border: 0; outline: none;"
                                />
                            </a>
                        </td>
                    </tr>
                    <tr>
                        <td align="left" style="padding: 16px 40px 32px 40px;">
                            <h1 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 700; color: #ffffff; text-align: center; line-height: 1.3;">
                                Your Account is Active! 🚀
                            </h1>
                            <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.5; color: #cbd5e1; text-align: center;">
                                Hi {{displayName}},
                            </p>
                            <p style="margin: 0 0 32px 0; font-size: 15px; line-height: 1.6; color: #94a3b8; text-align: center;">
                                Welcome to Edublast. Your 14-day premium testing trial has been successfully unlocked. Read below to maximize your account metrics and claim your bonus extension.
                            </p>
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #1e293b; border-radius: 10px; border: 1px solid #2e3e56; margin-bottom: 20px;">
                                <tr>
                                    <td style="padding: 20px 24px;">
                                        <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                            <tr>
                                                <td align="left" valign="middle">
                                                    <p style="margin: 0; font-size: 12px; font-weight: 700; color: #3b82f6; text-transform: uppercase; letter-spacing: 1px;">Current Tier</p>
                                                    <p style="margin: 4px 0 0 0; font-size: 18px; font-weight: 700; color: #ffffff;">14-Day Free Trial</p>
                                                </td>
                                                <td align="right" valign="middle">
                                                    <span style="display: inline-block; background-color: rgba(59, 130, 246, 0.15); color: #60a5fa; font-size: 13px; font-weight: 600; padding: 6px 12px; border-radius: 20px;">Active Now</span>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0f172a; border-radius: 10px; border: 1px solid #10b981; margin-bottom: 32px;">
                                <tr>
                                    <td style="padding: 24px;">
                                        <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                            <tr>
                                                <td colspan="2" style="padding-bottom: 12px;">
                                                    <span style="background-color: rgba(16, 185, 129, 0.15); color: #34d399; font-size: 11px; font-weight: 700; padding: 4px 8px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Unlock Challenge</span>
                                                    <h3 style="margin: 8px 0 4px 0; font-size: 16px; font-weight: 700; color: #ffffff;">The 44-Day Streak Bonus</h3>
                                                    <p style="margin: 0; font-size: 13px; color: #94a3b8; line-height: 1.5;">
                                                        Maintain your daily platform activity streak for exactly <strong style="color: #e2e8f0;">44 consecutive days</strong> directly following your sign-up, and you will unlock an absolute <strong style="color: #e2e8f0;">1-Month Premium Bonus Extension</strong> added completely free to your timeline.
                                                    </p>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td colspan="2" style="padding-top: 12px; border-top: 1px solid #222f43;">
                                                    <p style="margin: 0; font-size: 12px; color: #64748b; line-height: 1.4;">
                                                        💡 <strong style="color: #cbd5e1;">Rule Engine Check:</strong> If the streak is dropped or broken, the regular 14-day trial remains functional, but the 30-day bonus extension expires permanently. Keep the streak active to capture the full reward.
                                                    </p>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                <tr>
                                    <td align="center">
                                        <a href="{{dashboardUrl}}" target="_blank" style="display: inline-block; background-color: #3b82f6; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 8px; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3); letter-spacing: -0.2px;">
                                            Initialize Daily Streak
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td align="left" style="padding: 24px 40px; background-color: #0f172a; border-top: 1px solid #222f43;">
                            <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                <tr>
                                    <td align="left">
                                        <p style="margin: 0 0 4px 0; font-size: 12px; color: #475569; font-weight: 600;">
                                            &copy; {{year}} Edublast Platforms.
                                        </p>
                                        <p style="margin: 0; font-size: 11px; color: #334155; line-height: 1.4;">
                                            Automated transactional billing trigger. You are receiving this because your email address was verified via student secure login auth paths.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
