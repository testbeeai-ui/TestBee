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
  teacherAssignmentPublishChargeWaived,
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

  it("free tier has 24 live classes and 10 assignments", () => {
    const limits = getTeacherPlanLimits(cfg, "free");
    expect(limits.liveClassesPerMonth).toBe(24);
    expect(limits.assignmentsPerMonth).toBe(10);
  });

  it("starter has 60 live classes and unlimited assignments", () => {
    const limits = getTeacherPlanLimits(cfg, "starter");
    expect(limits.liveClassesPerMonth).toBe(60);
    expect(limits.assignmentsPerMonth).toBe(9999);
  });

  it("pro has unlimited live classes", () => {
    expect(getTeacherPlanLimits(cfg, "pro").liveClassesPerMonth).toBe(9999);
  });
});

describe("quota helpers", () => {
  const starterLimits = getTeacherPlanLimits(TEACHER_PLAN_CONFIG_DEFAULTS, "starter");

  it("allows free teacher until 24 bookings", () => {
    const freeLimits = getTeacherPlanLimits(TEACHER_PLAN_CONFIG_DEFAULTS, "free");
    expect(canBookMoreLiveClasses(0, freeLimits).allowed).toBe(true);
    expect(canBookMoreLiveClasses(23, freeLimits).allowed).toBe(true);
    expect(canBookMoreLiveClasses(24, freeLimits).allowed).toBe(false);
  });

  it("allows starter until 60 bookings", () => {
    expect(canBookMoreLiveClasses(59, starterLimits).allowed).toBe(true);
    expect(canBookMoreLiveClasses(60, starterLimits).allowed).toBe(false);
  });

  it("pro live classes are unlimited", () => {
    const proLimits = getTeacherPlanLimits(TEACHER_PLAN_CONFIG_DEFAULTS, "pro");
    expect(canBookMoreLiveClasses(500, proLimits).allowed).toBe(true);
  });

  it("starter assignments are effectively unlimited", () => {
    expect(canCreateMoreAssignments(100, starterLimits).allowed).toBe(true);
  });

  it("allows free tier until 10 assignments", () => {
    const freeLimits = getTeacherPlanLimits(TEACHER_PLAN_CONFIG_DEFAULTS, "free");
    expect(canCreateMoreAssignments(9, freeLimits).allowed).toBe(true);
    expect(canCreateMoreAssignments(10, freeLimits).allowed).toBe(false);
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

  it("waives assignment publish charge only on Pro", () => {
    expect(teacherAssignmentPublishChargeWaived("free")).toBe(false);
    expect(teacherAssignmentPublishChargeWaived("starter")).toBe(false);
    expect(teacherAssignmentPublishChargeWaived("pro")).toBe(true);
  });
});
