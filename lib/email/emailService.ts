import "server-only";

import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import {
  checkEmailDailyCap,
  logTransactionalEmail,
  type TransactionalEmailKind,
} from "@/lib/email/transactionalEmailLog";

export type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** When set, enforces IST daily cap and writes to transactional_email_logs. */
  log?: {
    kind: TransactionalEmailKind;
    userId?: string | null;
  };
};

export type SendEmailResult =
  | { success: true; messageId: string }
  | { success: false; error: string };

type EmailEnv = {
  host: string;
  port: number;
  user: string;
  pass: string;
};

function readEmailEnv(): EmailEnv | null {
  const host = process.env.EMAIL_SERVER_HOST?.trim();
  const portRaw = process.env.EMAIL_SERVER_PORT?.trim();
  const user = process.env.EMAIL_SERVER_USER?.trim();
  const pass = process.env.EMAIL_SERVER_PASSWORD?.trim().replace(/\s+/g, "");

  if (!host || !portRaw || !user || !pass) return null;

  const port = Number(portRaw);
  if (!Number.isFinite(port) || port <= 0) return null;

  return { host, port, user, pass };
}

let cachedTransporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (cachedTransporter) return cachedTransporter;

  const env = readEmailEnv();
  if (!env) return null;

  cachedTransporter = nodemailer.createTransport({
    host: env.host,
    port: env.port,
    secure: env.port === 465,
    auth: {
      user: env.user,
      pass: env.pass,
    },
  });

  return cachedTransporter;
}

export function getEmailFromAddress(): string | null {
  return process.env.EMAIL_SERVER_USER?.trim() || null;
}

export function getEmailAdminAddress(): string | null {
  return process.env.EMAIL_ADMIN?.trim() || null;
}

export function isEmailConfigured(): boolean {
  return getTransporter() !== null && !!getEmailFromAddress();
}

/**
 * Send an email via Nodemailer using EMAIL_SERVER_* env vars.
 * Never throws — returns { success: false } on misconfiguration or transport errors.
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const from = getEmailFromAddress();
  const transporter = getTransporter();

  if (!from || !transporter) {
    return {
      success: false,
      error: "Email is not configured (EMAIL_SERVER_HOST/PORT/USER/PASSWORD).",
    };
  }

  const to = params.to.trim();
  if (!to) {
    return { success: false, error: "Recipient address is required." };
  }

  if (params.log) {
    const capError = await checkEmailDailyCap();
    if (capError) {
      await logTransactionalEmail({
        kind: params.log.kind,
        recipient: to,
        subject: params.subject,
        status: "blocked_cap",
        userId: params.log.userId,
        errorMessage: capError,
      });
      return { success: false, error: capError };
    }
  }

  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject: params.subject,
      html: params.html,
      text: params.text ?? stripHtmlToText(params.html),
    });

    const messageId = String(info.messageId ?? "");
    if (params.log) {
      await logTransactionalEmail({
        kind: params.log.kind,
        recipient: to,
        subject: params.subject,
        status: "sent",
        userId: params.log.userId,
        messageId,
      });
    }

    return {
      success: true,
      messageId,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown email error";
    console.error("[emailService] sendMail failed:", message);
    if (params.log) {
      await logTransactionalEmail({
        kind: params.log.kind,
        recipient: to,
        subject: params.subject,
        status: "failed",
        userId: params.log.userId,
        errorMessage: message,
      });
    }
    return { success: false, error: message };
  }
}

function stripHtmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
