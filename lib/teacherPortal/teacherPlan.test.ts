import { describe, expect, it } from "vitest";
import {
  canBookMoreLiveClasses,
  canCreateMoreAssignments,
  canUseGoogleCalendarSeries,
  getTeacherPlanLimits,
  istMonthBoundsForDate,
  normalizeTeacherPlanTier,
  TEACHER_PLAN_CONFIG_DEFAULTS,
  teacherPlanConfigFromRows,
  wizardSectionHasCalendarSync,
} from "./teacherPlan";

describe("normalizeTeacherPlanTier", () => {
  it("returns free when paid plan expired", () => {
    const tier = normalizeTeacherPlanTier("pro", {
      teacher_plan_expires_at: "2020-01-01T00:00:00.000Z",
    });
    expect(tier).toBe("free");
  });

  it("returns starter when active", () => {
    const tier = normalizeTeacherPlanTier("starter", {
      teacher_plan_expires_at: "2099-01-01T00:00:00.000Z",
    });
    expect(tier).toBe("starter");
  });

  it("returns free when paid tier has no expiry", () => {
    expect(normalizeTeacherPlanTier("pro", {})).toBe("free");
    expect(normalizeTeacherPlanTier("pro", { teacher_plan_expires_at: null })).toBe("free");
  });
});

describe("istMonthBoundsForDate", () => {
  it("uses IST midnight boundaries as UTC instants", () => {
    const ref = new Date("2026-07-15T12:00:00.000Z");
    const { start, end } = istMonthBoundsForDate(ref);
    expect(start.toISOString()).toBe("2026-06-30T18:30:00.000Z");
    expect(end.toISOString()).toBe("2026-07-31T18:30:00.000Z");
  });
});

describe("getTeacherPlanLimits", () => {
  const cfg = { ...TEACHER_PLAN_CONFIG_DEFAULTS };

  it("free tier has 0 live classes", () => {
    expect(getTeacherPlanLimits(cfg, "free").liveClassesPerMonth).toBe(0);
  });

  it("starter has 4 live classes and 10 assignments", () => {
    const limits = getTeacherPlanLimits(cfg, "starter");
    expect(limits.liveClassesPerMonth).toBe(4);
    expect(limits.assignmentsPerMonth).toBe(10);
  });

  it("pro has 12 live classes", () => {
    expect(getTeacherPlanLimits(cfg, "pro").liveClassesPerMonth).toBe(12);
  });
});

describe("quota helpers", () => {
  const starterLimits = getTeacherPlanLimits(TEACHER_PLAN_CONFIG_DEFAULTS, "starter");

  it("blocks free teacher from booking", () => {
    const freeLimits = getTeacherPlanLimits(TEACHER_PLAN_CONFIG_DEFAULTS, "free");
    expect(canBookMoreLiveClasses(0, freeLimits).allowed).toBe(false);
  });

  it("allows starter until 4 bookings", () => {
    expect(canBookMoreLiveClasses(3, starterLimits).allowed).toBe(true);
    expect(canBookMoreLiveClasses(4, starterLimits).allowed).toBe(false);
  });

  it("blocks starter after 10 assignments", () => {
    expect(canCreateMoreAssignments(9, starterLimits).allowed).toBe(true);
    expect(canCreateMoreAssignments(10, starterLimits).allowed).toBe(false);
  });
});

describe("teacherPlanConfigFromRows", () => {
  it("clamps invalid values", () => {
    const cfg = teacherPlanConfigFromRows([
      { key: "teacher_starter_live_classes_per_month", value: -5 },
    ]);
    expect(cfg.teacher_starter_live_classes_per_month).toBe(0);
  });
});

describe("calendar series gating", () => {
  it("free cannot use google calendar series", () => {
    expect(canUseGoogleCalendarSeries("free")).toBe(false);
    expect(canUseGoogleCalendarSeries("starter")).toBe(true);
    expect(canUseGoogleCalendarSeries("pro")).toBe(true);
  });

  it("detects wizard section calendar draft", () => {
    expect(
      wizardSectionHasCalendarSync({
        scheduleDate: "2026-06-01",
        scheduleTime: "18:00",
        repeatDays: ["Mon"],
      })
    ).toBe(true);
    expect(wizardSectionHasCalendarSync({ scheduleDate: "", scheduleTime: "", repeatDays: [] })).toBe(
      false
    );
  });
});
