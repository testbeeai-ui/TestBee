import { describe, expect, it } from "vitest";
import {
  computeMagicWallUsage,
  getRollingMonthlyPeriodBounds,
  utcDateAtYearMonth,
} from "./magicWallQuota";

describe("utcDateAtYearMonth", () => {
  it("clamps Jan 31 anchor into February", () => {
    const feb = utcDateAtYearMonth(2026, 1, 31);
    expect(feb.getUTCMonth()).toBe(1);
    expect(feb.getUTCDate()).toBe(28);
  });
});

describe("getRollingMonthlyPeriodBounds", () => {
  it("uses signup day within the same calendar month", () => {
    const anchor = "2026-05-15T10:00:00.000Z";
    const now = new Date("2026-05-20T12:00:00.000Z");
    const { periodStart, periodEnd } = getRollingMonthlyPeriodBounds(anchor, now);
    expect(periodStart.toISOString()).toBe("2026-05-15T00:00:00.000Z");
    expect(periodEnd.toISOString()).toBe("2026-06-15T00:00:00.000Z");
  });

  it("rolls back to previous month when now is before anniversary", () => {
    const anchor = "2026-05-15T10:00:00.000Z";
    const now = new Date("2026-06-10T12:00:00.000Z");
    const { periodStart, periodEnd } = getRollingMonthlyPeriodBounds(anchor, now);
    expect(periodStart.toISOString()).toBe("2026-05-15T00:00:00.000Z");
    expect(periodEnd.toISOString()).toBe("2026-06-15T00:00:00.000Z");
  });

  it("advances period after anniversary in new month", () => {
    const anchor = "2026-05-15T10:00:00.000Z";
    const now = new Date("2026-06-20T12:00:00.000Z");
    const { periodStart, periodEnd } = getRollingMonthlyPeriodBounds(anchor, now);
    expect(periodStart.toISOString()).toBe("2026-06-15T00:00:00.000Z");
    expect(periodEnd.toISOString()).toBe("2026-07-15T00:00:00.000Z");
  });

  it("handles Jan 31 signup into February period end", () => {
    const anchor = "2026-01-31T08:00:00.000Z";
    const now = new Date("2026-02-10T12:00:00.000Z");
    const { periodStart, periodEnd } = getRollingMonthlyPeriodBounds(anchor, now);
    expect(periodStart.toISOString()).toBe("2026-01-31T00:00:00.000Z");
    expect(periodEnd.toISOString()).toBe("2026-02-28T00:00:00.000Z");
  });
});

describe("computeMagicWallUsage", () => {
  const periodStart = new Date("2026-05-15T00:00:00.000Z");
  const periodEnd = new Date("2026-06-15T00:00:00.000Z");

  it("limits new picks by active slots when one topic is carried over", () => {
    const usage = computeMagicWallUsage({
      plan: "free",
      activeCount: 1,
      monthlyUsed: 0,
      maxActive: 2,
      monthlyLimit: 2,
      periodStart,
      periodEnd,
    });
    expect(usage.activeSlotsRemaining).toBe(1);
    expect(usage.monthlyRemaining).toBe(2);
    expect(usage.newPicksAllowed).toBe(1);
  });

  it("allows zero new picks when basket is full", () => {
    const usage = computeMagicWallUsage({
      plan: "free",
      activeCount: 2,
      monthlyUsed: 1,
      maxActive: 2,
      monthlyLimit: 2,
      periodStart,
      periodEnd,
    });
    expect(usage.newPicksAllowed).toBe(0);
    expect(usage.monthlyRemaining).toBe(1);
  });

  it("returns null newPicksAllowed when monthly is unlimited", () => {
    const usage = computeMagicWallUsage({
      plan: "pro",
      activeCount: 3,
      monthlyUsed: 10,
      maxActive: 5,
      monthlyLimit: -1,
      periodStart,
      periodEnd,
    });
    expect(usage.newPicksAllowed).toBe(2);
    expect(usage.monthlyRemaining).toBeNull();
  });
});
