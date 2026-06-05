/**
 * One-off: send the new-user welcome HTML to a test inbox.
 * Usage: npx tsx --env-file=.env scripts/send-welcome-preview.ts [email]
 */
import nodemailer from "nodemailer";
import { buildNewUserWelcomeEmail } from "../lib/email/newUserWelcomeTemplate";
import { getPortalBaseUrl } from "../lib/email/portalBaseUrl";

const to = process.argv[2]?.trim() || "michaelkillgta@gmail.com";
const base = getPortalBaseUrl();
const { subject, html, text } = buildNewUserWelcomeEmail({
  displayName: "Michael",
  role: "student",
  portalBaseUrl: base,
});

const host = process.env.EMAIL_SERVER_HOST?.trim();
const port = Number(process.env.EMAIL_SERVER_PORT);
const user = process.env.EMAIL_SERVER_USER?.trim();
const pass = (process.env.EMAIL_SERVER_PASSWORD || "").replace(/\s+/g, "");

if (!host || !port || !user || !pass) {
  console.error("Missing EMAIL_SERVER_* in .env");
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host,
  port,
  secure: port === 465,
  auth: { user, pass },
});

async function main() {
  const info = await transporter.sendMail({
    from: user,
    to,
    subject,
    html,
    text,
  });

  console.log(`Sent to ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`Links base: ${base}`);
  console.log(`messageId: ${info.messageId}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
