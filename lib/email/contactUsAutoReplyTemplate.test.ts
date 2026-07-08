import { describe, expect, it } from "vitest";
import { buildContactUsAutoReplyEmail } from "./contactUsAutoReplyTemplate";

describe("buildContactUsAutoReplyEmail", () => {
  it("builds sales auto-reply with ticket id", () => {
    const { subject, html, text } = buildContactUsAutoReplyEmail({
      category: "sales",
      name: "Priya Mehta",
      ticketId: "EB-2026-1234",
      email: "priya@example.com",
    });
    expect(subject).toContain("EB-2026-1234");
    expect(html).toContain("Partnership enquiry received");
    expect(html).toContain("priya@example.com");
    expect(text).toContain("Hi Priya");
  });

  it("builds issue auto-reply", () => {
    const { subject, html } = buildContactUsAutoReplyEmail({
      category: "issue",
      name: "Arjun",
      ticketId: "EB-2026-5678",
      email: "arjun@example.com",
    });
    expect(subject).toContain("issue report");
    expect(html).toContain("Issue report submitted");
  });

  it("builds comment auto-reply", () => {
    const { html } = buildContactUsAutoReplyEmail({
      category: "comment",
      name: "Sam",
      ticketId: "EB-2026-9999",
      email: "sam@example.com",
    });
    expect(html).toContain("Feedback recorded");
  });
});
