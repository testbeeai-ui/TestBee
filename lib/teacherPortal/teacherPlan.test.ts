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

  it("free tier has 12 live classes and 12 assignments", () => {
    const limits = getTeacherPlanLimits(cfg, "free");
    expect(limits.liveClassesPerMonth).toBe(12);
    expect(limits.assignmentsPerMonth).toBe(12);
  });

  it("starter has 24 live classes and 24 assignments", () => {
    const limits = getTeacherPlanLimits(cfg, "starter");
    expect(limits.liveClassesPerMonth).toBe(24);
    expect(limits.assignmentsPerMonth).toBe(24);
  });

  it("pro has 60 included live classes and assignments", () => {
    const pro = getTeacherPlanLimits(cfg, "pro");
    expect(pro.liveClassesPerMonth).toBe(60);
    expect(pro.assignmentsPerMonth).toBe(60);
  });
});

describe("quota helpers", () => {
  const starterLimits = getTeacherPlanLimits(TEACHER_PLAN_CONFIG_DEFAULTS, "starter");

  it("allows free teacher until 12 bookings", () => {
    const freeLimits = getTeacherPlanLimits(TEACHER_PLAN_CONFIG_DEFAULTS, "free");
    expect(canBookMoreLiveClasses(0, freeLimits, "free").allowed).toBe(true);
    expect(canBookMoreLiveClasses(11, freeLimits, "free").allowed).toBe(true);
    expect(canBookMoreLiveClasses(12, freeLimits, "free").allowed).toBe(false);
  });

  it("allows starter until 24 bookings", () => {
    expect(canBookMoreLiveClasses(23, starterLimits, "starter").allowed).toBe(true);
    expect(canBookMoreLiveClasses(24, starterLimits, "starter").allowed).toBe(false);
  });

  it("pro live classes allow overage at cap", () => {
    const proLimits = getTeacherPlanLimits(TEACHER_PLAN_CONFIG_DEFAULTS, "pro");
    const atCap = canBookMoreLiveClasses(60, proLimits, "pro");
    expect(atCap.allowed).toBe(true);
    expect(atCap.isOverage).toBe(true);
  });

  it("starter assignments block at 24", () => {
    expect(canCreateMoreAssignments(23, starterLimits, "starter").allowed).toBe(true);
    expect(canCreateMoreAssignments(24, starterLimits, "starter").allowed).toBe(false);
  });

  it("allows free tier until 12 assignments", () => {
    const freeLimits = getTeacherPlanLimits(TEACHER_PLAN_CONFIG_DEFAULTS, "free");
    expect(canCreateMoreAssignments(11, freeLimits, "free").allowed).toBe(true);
    expect(canCreateMoreAssignments(12, freeLimits, "free").allowed).toBe(false);
  });

  it("pro assignments allow overage at cap", () => {
    const proLimits = getTeacherPlanLimits(TEACHER_PLAN_CONFIG_DEFAULTS, "pro");
    const atCap = canCreateMoreAssignments(60, proLimits, "pro");
    expect(atCap.allowed).toBe(true);
    expect(atCap.isOverage).toBe(true);
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

  it("waives assignment publish charge only on Pro within included quota", () => {
    expect(teacherAssignmentPublishChargeWaived("free")).toBe(false);
    expect(teacherAssignmentPublishChargeWaived("starter")).toBe(false);
    expect(teacherAssignmentPublishChargeWaived("pro")).toBe(true);
    expect(teacherAssignmentPublishChargeWaived("pro", true)).toBe(false);
  });
});
