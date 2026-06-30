import { describe, expect, it } from "vitest";
import { buildTeacherWalletGuide } from "@/lib/teacherPortal/teacherWalletGuide";

describe("buildTeacherWalletGuide", () => {
  it("includes earn and spend sections", () => {
    const guide = buildTeacherWalletGuide();
    expect(guide.earn.length).toBeGreaterThan(3);
    expect(guide.spend.length).toBeGreaterThan(3);
    expect(guide.earn.some((r) => r.label === "Gyan++ answer")).toBe(true);
    expect(guide.spend.some((r) => r.label === "MCQ unlock · free student")).toBe(true);
  });
});
