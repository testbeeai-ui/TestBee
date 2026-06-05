import { describe, expect, it } from "vitest";

describe("loginNotificationTemplate", () => {
  it("builds subject and html with student name and time", async () => {
    const { buildStudentLoginNotificationEmail } = await import(
      "@/lib/email/loginNotificationTemplate"
    );
    const { subject, html } = buildStudentLoginNotificationEmail({
      studentName: "Riya",
      loginAtLabel: "Tuesday, 3 June 2026, 01:30 pm",
    });
    expect(subject).toContain("Testbee");
    expect(html).toContain("Riya");
    expect(html).toContain("01:30 pm");
  });
});

describe("newUserWelcomeTemplate", () => {
  it("builds student welcome with custom HTML and dashboard link", async () => {
    const { buildNewUserWelcomeEmail } = await import("@/lib/email/newUserWelcomeTemplate");
    const { subject, html, text } = buildNewUserWelcomeEmail({
      displayName: "Arjun",
      role: "student",
      portalBaseUrl: "https://example.com",
    });
    expect(subject).toContain("Edublast");
    expect(html).toContain("Arjun");
    expect(html).toContain("https://example.com/home");
    expect(html).toContain("https://example.com/images/logo-2.png");
    expect(html).toContain('alt="Edublast"');
    expect(html).toContain("44-Day Streak Bonus");
    expect(html).toContain("Initialize Daily Streak");
    expect(text).toContain("44 consecutive days");
  });

  it("builds teacher welcome with classroom link", async () => {
    const { buildNewUserWelcomeEmail } = await import("@/lib/email/newUserWelcomeTemplate");
    const { html } = buildNewUserWelcomeEmail({
      displayName: "Priya",
      role: "teacher",
      portalBaseUrl: "https://example.com",
    });
    expect(html).toContain("teacher-portal/classrooms");
    expect(html).toContain("classroom hub");
  });
});
