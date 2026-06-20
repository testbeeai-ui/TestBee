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

describe("waitlistEmailTemplate", () => {
  it("builds Step 1 confirmation with waitlist id and ambassador link", async () => {
    const { buildWaitlistConfirmationEmail } = await import("@/lib/email/waitlistEmailTemplate");
    const { subject, html, text } = buildWaitlistConfirmationEmail({
      waitlistId: "EB-2026-1234",
      email: "arjun@example.com",
      phone: "9876543210",
    });
    expect(subject).toContain("EB-2026-1234");
    expect(html).toContain("arjun@example.com");
    expect(html).toContain("Ambassador");
    expect(text).toContain("EB-2026-1234");
  });

  it("builds Step 2 ambassador receipt for student role", async () => {
    const { buildAmbassadorApplicationEmail } = await import("@/lib/email/waitlistEmailTemplate");
    const { subject, html } = buildAmbassadorApplicationEmail({
      waitlistId: "EB-2026-5678",
      firstName: "Arjun",
      lastName: "Sharma",
      email: "arjun@example.com",
      phone: "9876543210",
      role: "student",
    });
    expect(subject).toContain("Ambassador");
    expect(html).toContain("Arjun");
    expect(html).toContain("Ambassador");
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
