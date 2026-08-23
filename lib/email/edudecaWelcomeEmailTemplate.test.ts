import { describe, expect, it } from "vitest";

import { buildEduDecaStudentWelcomeEmail } from "@/lib/email/edudecaWelcomeEmailTemplate";

describe("buildEduDecaStudentWelcomeEmail", () => {
  it("builds welcome subject, html, and text with logo and CTA", () => {
    const { subject, html, text } = buildEduDecaStudentWelcomeEmail({
      email: "adwait.kamble23@pccoepune.org",
      displayName: "Adwait",
      ctaUrl: "https://edu-deca.vercel.app",
      logoBaseUrl: "https://www.edublast.in",
    });

    expect(subject).toBe("Welcome to EduDeca, Adwait");
    expect(html).toContain("Welcome aboard, Adwait");
    expect(html).toContain("https://www.edublast.in/images/logo-2.png");
    expect(html).toContain('alt="EduBlast"');
    expect(html).toContain("Continue to EduDeca");
    expect(html).toContain("www.edudeca.com");
    expect(html).toContain("admin@edudeca.com");
    expect(html).toContain("You're registered for EduDeca");
    expect(html).toContain("EduDeca Academic Decathlon Challenge");
    expect(html).toContain("Levels 1–2");
    expect(html).toContain("WHAT'S NEXT");
    expect(html).toContain("www.edubite.com");
    expect(html).toContain("Open EduBite");
    expect(html).toContain("Questions? ");
    expect(html).toContain("EduBlast · edudeca.com");
    expect(html).not.toContain("QR");
    expect(html).not.toContain("Google Play");
    expect(html).not.toContain("TestFlight");
    expect(html).not.toContain("data:image");
    expect(html).not.toContain("join@edublast.in");
    expect(text).toContain("Welcome aboard, Adwait");
    expect(text).toContain("www.edudeca.com");
    expect(text).toContain("admin@edudeca.com");
    expect(text).toContain("edudeca.com");
    expect(text).toContain("Levels 1–2");
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
