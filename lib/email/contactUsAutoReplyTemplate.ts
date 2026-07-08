import { escapeHtml } from "@/lib/email/applyEmailTemplate";
import { wrapTransactionalEmailBody } from "@/lib/email/waitlistEmailTemplate";
import type { ContactCategory } from "@/lib/contact/contactMessageTypes";
import { CONTACT_CATEGORY_LABELS } from "@/lib/contact/contactMessageTypes";

type CategoryTheme = {
  accent: string;
  accentSoft: string;
  subject: string;
  headline: string;
  body: string;
  eta: string;
};

const THEMES: Record<ContactCategory, CategoryTheme> = {
  sales: {
    accent: "#0fba8a",
    accentSoft: "#0A2A20",
    subject: "We received your partnership enquiry",
    headline: "Partnership enquiry received",
    body:
      "Thank you for reaching out about sales or partnerships. Our business team will review your details and get back to you with next steps.",
    eta: "Expected response within 2 business days.",
  },
  issue: {
    accent: "#e8553a",
    accentSoft: "#2A1410",
    subject: "We received your issue report",
    headline: "Issue report submitted",
    body:
      "Thank you for reporting this. Our support team has logged your issue and will investigate what went wrong.",
    eta: "We aim to update you within 24 hours.",
  },
  comment: {
    accent: "#7c6bff",
    accentSoft: "#1A1533",
    subject: "Thanks for your feedback",
    headline: "Feedback recorded — thank you",
    body:
      "Your comment or suggestion helps us improve EduBlast for every student. We read every submission carefully.",
    eta: "If you asked for a follow-up, we'll reply to this email address.",
  },
};

export function buildContactUsAutoReplyEmail(params: {
  category: ContactCategory;
  name: string;
  ticketId: string;
  email: string;
}): { subject: string; html: string; text: string } {
  const { category, name, ticketId, email } = params;
  const theme = THEMES[category];
  const firstName = name.trim().split(/\s+/)[0] || "there";
  const categoryLabel = CONTACT_CATEGORY_LABELS[category];

  const bodyHtml = `
    <p style="margin:0 0 8px;font-size:13px;color:#9BA3B8;text-transform:uppercase;letter-spacing:0.08em;">EduBlast Contact Us</p>
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#E8EAF0;line-height:1.3;">${escapeHtml(theme.headline)}</h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#C5CAD6;">Hi ${escapeHtml(firstName)},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#C5CAD6;">${escapeHtml(theme.body)}</p>
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:20px 0;background-color:${theme.accentSoft};border:1px solid ${theme.accent};border-radius:12px;">
      <tr><td style="padding:18px 20px;">
        <p style="margin:0 0 6px;font-size:11px;color:${theme.accent};text-transform:uppercase;letter-spacing:0.06em;font-weight:600;">Your ticket</p>
        <p style="margin:0 0 10px;font-size:20px;font-weight:700;color:#E8EAF0;font-family:ui-monospace,monospace;">${escapeHtml(ticketId)}</p>
        <p style="margin:0;font-size:13px;line-height:1.5;color:#9BA3B8;">Category: <strong style="color:#E8EAF0;">${escapeHtml(categoryLabel)}</strong></p>
      </td></tr>
    </table>
    <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#9BA3B8;">${escapeHtml(theme.eta)}</p>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#9BA3B8;">Keep this email for reference. If you need to add more detail, reply to this message and include your ticket ID.</p>
    <div style="border-top:1px solid #2A3347;padding-top:16px;margin-top:8px;">
      <p style="margin:0;font-size:12px;color:#5C6480;line-height:1.5;">Sent to ${escapeHtml(email)} · EduBlast support</p>
    </div>
  `;

  const text = [
    theme.headline,
    "",
    `Hi ${firstName},`,
    "",
    theme.body,
    "",
    `Ticket ID: ${ticketId}`,
    `Category: ${categoryLabel}`,
    "",
    theme.eta,
    "",
    "— EduBlast",
  ].join("\n");

  return {
    subject: `${theme.subject} (${ticketId})`,
    html: wrapTransactionalEmailBody(bodyHtml, email),
    text,
  };
}
