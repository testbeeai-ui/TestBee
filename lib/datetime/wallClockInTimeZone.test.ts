import { describe, expect, it } from "vitest";
import { wallClockInTimeZoneToUtc } from "./wallClockInTimeZone";

describe("wallClockInTimeZoneToUtc", () => {
  it("converts IST wall time to UTC (UTC+5:30)", () => {
    const utc = wallClockInTimeZoneToUtc("2026-07-01", "18:00", "Asia/Kolkata");
    expect(utc.toISOString()).toBe("2026-07-01T12:30:00.000Z");
  });

  it("handles midnight IST", () => {
    const utc = wallClockInTimeZoneToUtc("2026-03-01", "00:00", "Asia/Kolkata");
    expect(utc.toISOString()).toBe("2026-02-28T18:30:00.000Z");
  });
});
