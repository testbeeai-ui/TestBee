import { describe, expect, it } from "vitest";
import { buildWeeklyRRule, repeatLabelsToByDay } from "./googleCalendarRrule";

describe("repeatLabelsToByDay", () => {
  it("maps weekdays", () => {
    expect(repeatLabelsToByDay(["Mon", "Wed", "Fri"])).toBe("MO,WE,FR");
  });
});

describe("buildWeeklyRRule", () => {
  it("builds open-ended weekly rule", () => {
    expect(buildWeeklyRRule({ repeatDays: ["Mon", "Wed"] })).toBe("RRULE:FREQ=WEEKLY;BYDAY=MO,WE");
  });

  it("adds UNTIL for end date", () => {
    expect(buildWeeklyRRule({ repeatDays: ["Sun"], untilDate: "2026-12-31" })).toBe(
      "RRULE:FREQ=WEEKLY;BYDAY=SU;UNTIL=20261231T235959Z"
    );
  });
});
