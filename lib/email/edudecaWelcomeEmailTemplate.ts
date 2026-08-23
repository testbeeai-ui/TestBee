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
  /** EduBite practice site (defaults to www.edubite.com). */
  edubiteUrl?: string;
};

const DEFAULT_EDUBITE_URL = "https://www.edubite.com";

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
  const edubiteUrl = (params.edubiteUrl?.trim() || DEFAULT_EDUBITE_URL).replace(/\/$/, "");

  const html = applyEmailTemplate(EDUDECA_STUDENT_WELCOME_HTML_TEMPLATE, {
    name: escapeHtml(name),
    ctaUrl: escapeHtml(ctaUrl),
    logoUrl: escapeHtml(logoUrl),
    year: escapeHtml(year),
    edubiteUrl: escapeHtml(edubiteUrl),
  });

  const text = [
    `Welcome aboard, ${name}`,
    "",
    "You're registered for EduDeca.",
    "",
    "Welcome to the EduDeca Academic Decathlon Challenge. We shall send you an email as soon as the competition window for Levels 1–2 gets open.",
    "",
    `Proceed to EduDeca (${ctaUrl}) or contact join@edublast.in should you have any queries.`,
    "",
    "WHAT'S NEXT",
    "Keep an eye on your inbox regularly — we'll let you know the moment Levels 1–2 go live. Also, keep checking your spam folder just in case.",
    "",
    `Meanwhile, you may like to use our EduBite site (${edubiteUrl}) for building everyday consistency, along with quick daily brain workouts.`,
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
