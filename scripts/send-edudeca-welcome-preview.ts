/**
 * One-off: send EduDeca student welcome HTML to a test inbox.
 * Usage: npx tsx --env-file=.env scripts/send-edudeca-welcome-preview.ts [email]
 */
import nodemailer from "nodemailer";

import { buildEduDecaStudentWelcomeEmail } from "../lib/email/edudecaWelcomeEmailTemplate";
import { EDUBLAST_PUBLIC_ORIGIN } from "../lib/email/portalBaseUrl";

const to = process.argv[2]?.trim() || "michaelkillgta@gmail.com";
const EDUDECA_PUBLIC_ORIGIN = "https://edu-deca.vercel.app";
const ctaFromEnv = process.env.NEXT_PUBLIC_EDUDECA_APP_URL?.trim();
const ctaUrl = (ctaFromEnv || EDUDECA_PUBLIC_ORIGIN).replace(/\/$/, "");

const { subject, html, text } = buildEduDecaStudentWelcomeEmail({
  email: to,
  displayName: "Michael",
  ctaUrl,
  logoBaseUrl: EDUBLAST_PUBLIC_ORIGIN,
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
    from: `"EduBlast" <${user}>`,
    to,
    subject,
    html,
    text,
  });

  console.log(`Sent EduDeca welcome to ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`CTA: ${ctaUrl}`);
  console.log(`messageId: ${info.messageId}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
