import { describe, expect, it } from "vitest";
import { buildGyanDoubtAccess } from "@/lib/subscription/gyanDoubtsLimits";
import {
  formatLessonsChapterLimitLabel,
  formatRdmMultiplierRateLabel,
  getPlanLimits,
  lessonsChapterLockEnabled,
  resolveLessonsChapterCap,
  SUBSCRIPTION_CONFIG_DEFAULTS,
} from "@/lib/subscription/subscriptionConfig";

describe("subscription plan limits (admin rdm_config keys)", () => {
  it("maps default keys per tier for all enforced features", () => {
    const free = getPlanLimits(SUBSCRIPTION_CONFIG_DEFAULTS, "free");
    const trial = getPlanLimits(SUBSCRIPTION_CONFIG_DEFAULTS, "free_trial");
    const starter = getPlanLimits(SUBSCRIPTION_CONFIG_DEFAULTS, "starter");
    const pro = getPlanLimits(SUBSCRIPTION_CONFIG_DEFAULTS, "pro");

    expect(free.gyanDoubtsPerDay).toBe(1);
    expect(trial.gyanDoubtsPerDay).toBe(1);
    expect(starter.gyanDoubtsPerDay).toBe(30);
    expect(pro.gyanDoubtsPerDay).toBe(-1);

    expect(free.lessonsChapterLimit).toBe(2);
    expect(free.instacueCardLimit).toBe(20);
    expect(starter.instacueCardLimit).toBe(200);
    expect(pro.instacueCardLimit).toBe(-1);

    expect(free.mocksPerMonth).toBe(3);
    expect(free.magicWallMonthlyAttempts).toBe(2);
    expect(pro.magicWallMonthlyAttempts).toBe(-1);

    expect(free.rdmMultiplierPct).toBe(25);
    expect(trial.rdmMultiplierPct).toBe(25);
    expect(starter.rdmMultiplierPct).toBe(50);
    expect(pro.rdmMultiplierPct).toBe(100);
  });

  it("formats 25% RDM as 0.25x not 0.3x", () => {
    expect(formatRdmMultiplierRateLabel(25)).toBe("0.25x rate");
    expect(formatRdmMultiplierRateLabel(50)).toBe("0.50x rate");
    expect(formatRdmMultiplierRateLabel(100)).toBe("1x rate");
    expect(formatRdmMultiplierRateLabel(150)).toBe("1.5x rate");
  });

  it("admin override merges into getPlanLimits", () => {
    const cfg = {
      ...SUBSCRIPTION_CONFIG_DEFAULTS,
      free_gyan_doubts_per_day: 5,
      free_lessons_chapter_limit: 3,
    };
    const free = getPlanLimits(cfg, "free");
    expect(free.gyanDoubtsPerDay).toBe(5);
    expect(free.lessonsChapterLimit).toBe(3);
  });
});

describe("lessons chapter cap helpers", () => {
  it("resolves finite cap and unlimited (-1)", () => {
    expect(resolveLessonsChapterCap(2)).toBe(2);
    expect(resolveLessonsChapterCap(-1)).toBe(Infinity);
    expect(lessonsChapterLockEnabled(2, true)).toBe(true);
    expect(lessonsChapterLockEnabled(-1, true)).toBe(false);
  });

  it("formats per-subject label (not monthly)", () => {
    expect(formatLessonsChapterLimitLabel(2)).toContain("per subject");
    expect(formatLessonsChapterLimitLabel(-1)).toContain("Unlimited");
  });
});

describe("gyanDoubtsLimits", () => {
  it("free: 1 doubt per IST day then blocked", () => {
    const at0 = buildGyanDoubtAccess({
      plan: "free",
      cfg: SUBSCRIPTION_CONFIG_DEFAULTS,
      usedToday: 0,
    });
    expect(at0.canPost).toBe(true);
    expect(at0.remaining).toBe(1);

    const at1 = buildGyanDoubtAccess({
      plan: "free",
      cfg: SUBSCRIPTION_CONFIG_DEFAULTS,
      usedToday: 1,
    });
    expect(at1.canPost).toBe(false);
    expect(at1.remaining).toBe(0);
  });

  it("pro: unlimited doubts", () => {
    const access = buildGyanDoubtAccess({
      plan: "pro",
      cfg: SUBSCRIPTION_CONFIG_DEFAULTS,
      usedToday: 100,
    });
    expect(access.unlimited).toBe(true);
    expect(access.canPost).toBe(true);
    expect(access.remaining).toBeNull();
  });
});
