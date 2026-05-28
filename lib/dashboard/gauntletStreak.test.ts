import { describe, expect, it } from "vitest";
import { computeStreakDays } from "./gauntletStreak";

describe("computeStreakDays", () => {
  it("can anchor streaks to a supplied date", () => {
    expect(computeStreakDays(["2026-05-27", "2026-05-26"], "2026-05-28")).toBe(2);
  });

  it("returns zero when the latest play is older than yesterday", () => {
    expect(computeStreakDays(["2026-05-25"], "2026-05-28")).toBe(0);
  });
});
