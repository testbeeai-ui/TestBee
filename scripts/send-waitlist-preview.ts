/**
 * Send waitlist confirmation HTML to a test inbox.
 * Usage: npx tsx --env-file=.env scripts/send-waitlist-preview.ts [email] [step]
 * step: 1 (default) | 2
 */
import nodemailer from "nodemailer";
import {
  buildAmbassadorApplicationEmail,
  buildWaitlistConfirmationEmail,
} from "../lib/email/waitlistEmailTemplate";

const to = process.argv[2]?.trim() || process.env.EMAIL_ADMIN?.trim();
const step = process.argv[3]?.trim() || "1";

const host = process.env.EMAIL_SERVER_HOST?.trim();
const port = Number(process.env.EMAIL_SERVER_PORT);
const user = process.env.EMAIL_SERVER_USER?.trim();
const pass = (process.env.EMAIL_SERVER_PASSWORD || "").replace(/\s+/g, "");

if (!to) {
  console.error("Usage: npx tsx --env-file=.env scripts/send-waitlist-preview.ts <email> [1|2]");
  process.exit(1);
}

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
  const payload =
    step === "2"
      ? buildAmbassadorApplicationEmail({
          waitlistId: "EB-2026-9999",
          firstName: "Test",
          lastName: "User",
          email: to,
          role: "student",
        })
      : buildWaitlistConfirmationEmail({
          waitlistId: "EB-2026-9999",
          email: to,
        });

  const info = await transporter.sendMail({
    from: user,
    to,
    subject: `[PREVIEW] ${payload.subject}`,
    html: payload.html,
    text: payload.text,
  });

  console.log(`Sent Step ${step} preview to ${to}`);
  console.log(`Subject: ${payload.subject}`);
  console.log(`messageId: ${info.messageId}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
