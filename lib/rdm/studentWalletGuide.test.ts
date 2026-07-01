import { describe, expect, it } from "vitest";
import { buildStudentWalletGuide } from "@/lib/rdm/studentWalletGuide";

describe("buildStudentWalletGuide", () => {
  it("includes earn and spend sections", () => {
    const guide = buildStudentWalletGuide();
    expect(guide.earn.length).toBeGreaterThan(5);
    expect(guide.spend.length).toBeGreaterThan(0);
    expect(guide.earn.some((r) => r.label === "Play · DailyDose academic")).toBe(true);
    expect(guide.earn.some((r) => r.label.startsWith("Teacher ·"))).toBe(true);
  });
});
