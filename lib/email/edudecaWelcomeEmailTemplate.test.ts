import { describe, expect, it } from "vitest";

import { buildEduDecaStudentWelcomeEmail } from "@/lib/email/edudecaWelcomeEmailTemplate";

describe("buildEduDecaStudentWelcomeEmail", () => {
  it("builds welcome subject, html, and text with logo and CTA", () => {
    const { subject, html, text } = buildEduDecaStudentWelcomeEmail({
      email: "adwait.kamble23@pccoepune.org",
      displayName: "Adwait",
      ctaUrl: "https://www.edublast.in/edudeca",
      logoBaseUrl: "https://www.edublast.in",
    });

    expect(subject).toBe("Welcome to EduDeca, Adwait");
    expect(html).toContain("Welcome aboard, Adwait");
    expect(html).toContain("https://www.edublast.in/images/logo-2.png");
    expect(html).toContain('alt="EduBlast"');
    expect(html).toContain("Continue to EduDeca");
    expect(html).toContain("https://www.edublast.in/edudeca");
    expect(html).toContain("You're registered for EduDeca");
    expect(text).toContain("Welcome aboard, Adwait");
    expect(text).toContain("https://www.edublast.in/edudeca");
  });

  it("escapes html in the display name", () => {
    const { html } = buildEduDecaStudentWelcomeEmail({
      email: "a@b.com",
      displayName: `<script>alert(1)</script>`,
      ctaUrl: "https://example.com",
      logoBaseUrl: "https://example.com",
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("falls back to a friendly name from the email local part", () => {
    const { subject, html } = buildEduDecaStudentWelcomeEmail({
      email: "priya.sharma@college.edu",
      ctaUrl: "https://example.com/cta",
      logoBaseUrl: "https://example.com",
    });
    expect(subject).toContain("Priya");
    expect(html).toContain("Welcome aboard, Priya");
  });
});
