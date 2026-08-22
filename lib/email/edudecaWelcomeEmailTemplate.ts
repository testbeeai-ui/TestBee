import { applyEmailTemplate, escapeHtml } from "@/lib/email/applyEmailTemplate";
import { EDUBLAST_EMAIL_LOGO_PATH } from "@/lib/email/newUserWelcomeTemplate";
import { EDUBLAST_PUBLIC_ORIGIN } from "@/lib/email/portalBaseUrl";
import { EDUDECA_STUDENT_WELCOME_HTML_TEMPLATE } from "@/lib/email/templates/edudecaStudentWelcome.html";

export type EduDecaStudentWelcomeParams = {
  email: string;
  /** Optional override; otherwise derived from the email local part. */
  displayName?: string;
  ctaUrl: string;
  /** Origin hosting `/images/logo-2.png` (defaults to EduBlast public site). */
  logoBaseUrl?: string;
};

/** First token of the email local part, title-cased (e.g. priya.sharma → Priya). */
export function displayNameFromEmail(email: string): string {
  const local = email.trim().split("@")[0] ?? "";
  const token = local.split(/[._+-]/).find((part) => part.length > 0) ?? "";
  if (!token) return "there";
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}

export function buildEduDecaStudentWelcomeEmail(params: EduDecaStudentWelcomeParams): {
  subject: string;
  html: string;
  text: string;
} {
  const name = (params.displayName?.trim() || displayNameFromEmail(params.email) || "there").trim();
  const logoBase = (params.logoBaseUrl ?? EDUBLAST_PUBLIC_ORIGIN).replace(/\/$/, "");
  const logoUrl = `${logoBase}${EDUBLAST_EMAIL_LOGO_PATH}`;
  const year = String(new Date().getFullYear());
  const ctaUrl = params.ctaUrl.trim();

  const html = applyEmailTemplate(EDUDECA_STUDENT_WELCOME_HTML_TEMPLATE, {
    name: escapeHtml(name),
    ctaUrl: escapeHtml(ctaUrl),
    logoUrl: escapeHtml(logoUrl),
    year: escapeHtml(year),
  });

  const text = [
    `Welcome aboard, ${name}`,
    "",
    "You're registered for EduDeca — Edublast's student competition and prep track.",
    "",
    "Thanks for signing up. Practice when you're ready, or hang tight — we'll email you when the next launch window arrives. No spam, just the useful stuff.",
    "",
    "Continue to EduDeca:",
    ctaUrl,
    "",
    "Questions? join@edublast.in",
    "",
    "— EduBlast",
    `© ${year} · edu-deca.vercel.app`,
  ].join("\n");

  return {
    subject: `Welcome to EduDeca, ${name}`,
    html,
    text,
  };
}
