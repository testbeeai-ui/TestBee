import { describe, expect, it } from "vitest";
import {
  FREE_TRIAL_DURATION_DAYS,
  FREE_TRIAL_DURATION_MS,
  isFreeTrialActiveForProfile,
  isFreeTrialPeriodEndedForProfile,
  resolveTrialDurationDaysForProfile,
  resolveTrialDurationMsForProfile,
} from "@/lib/subscription/freeTrialTimer";

const MS_DAY = 24 * 60 * 60 * 1000;
const ACTIVATED = "2026-06-01T10:00:00.000Z";

function baseProfile(overrides: Record<string, unknown> = {}) {
  return {
    free_trial_activated: true,
    free_trial_activated_at: ACTIVATED,
    created_at: ACTIVATED,
    trial_second_round_activated: false,
    trial_end_bonus_activated: false,
    ...overrides,
  };
}

describe("investor rule: trial base duration", () => {
  it("exports the canonical 14-day base", () => {
    expect(FREE_TRIAL_DURATION_DAYS).toBe(14);
    expect(FREE_TRIAL_DURATION_MS).toBe(14 * MS_DAY);
  });

  it("first-round duration = base 14d", () => {
    expect(resolveTrialDurationDaysForProfile(baseProfile(), null)).toBe(14);
    expect(resolveTrialDurationMsForProfile(baseProfile(), null)).toBe(14 * MS_DAY);
  });

  it("second-round duration = base + streak extension (14 + 14 = 28)", () => {
    const p = baseProfile({ trial_second_round_activated: true });
    expect(resolveTrialDurationDaysForProfile(p, null)).toBe(28);
    expect(resolveTrialDurationMsForProfile(p, null)).toBe(28 * MS_DAY);
  });

  it("honours admin-configurable base length", () => {
    expect(
      resolveTrialDurationDaysForProfile(baseProfile(), {
        free_trial_duration_days: 7,
        free_trial_streak_extension_days: 7,
      })
    ).toBe(7);
  });

  it("honours admin-configurable extension length", () => {
    const p = baseProfile({ trial_second_round_activated: true });
    expect(
      resolveTrialDurationDaysForProfile(p, {
        free_trial_duration_days: 14,
        free_trial_streak_extension_days: 21,
      })
    ).toBe(35);
  });
});

describe("isFreeTrialPeriodEndedForProfile (configurable)", () => {
  it("ends at 14d (default) for first round", () => {
    const p = baseProfile();
    const start = Date.parse(ACTIVATED);
    expect(isFreeTrialPeriodEndedForProfile(p, start + 13 * MS_DAY)).toBe(false);
    expect(isFreeTrialPeriodEndedForProfile(p, start + 14 * MS_DAY)).toBe(true);
  });

  it("ends at 28d (default) for second round", () => {
    const p = baseProfile({ trial_second_round_activated: true });
    const start = Date.parse(ACTIVATED);
    expect(isFreeTrialPeriodEndedForProfile(p, start + 27 * MS_DAY)).toBe(false);
    expect(isFreeTrialPeriodEndedForProfile(p, start + 28 * MS_DAY)).toBe(true);
  });

  it("ends at admin-configured 7d + 7d = 14d", () => {
    const p = baseProfile({ trial_second_round_activated: true });
    const cfg = { free_trial_duration_days: 7, free_trial_streak_extension_days: 7 };
    const start = Date.parse(ACTIVATED);
    expect(isFreeTrialPeriodEndedForProfile(p, start + 13 * MS_DAY, cfg)).toBe(false);
    expect(isFreeTrialPeriodEndedForProfile(p, start + 14 * MS_DAY, cfg)).toBe(true);
  });
});

describe("isFreeTrialActiveForProfile", () => {
  const start = Date.parse(ACTIVATED);

  it("true during the first-round window", () => {
    expect(isFreeTrialActiveForProfile(baseProfile(), start + 5 * MS_DAY)).toBe(true);
  });

  it("false after the first-round window ends", () => {
    expect(isFreeTrialActiveForProfile(baseProfile(), start + 14 * MS_DAY)).toBe(false);
  });

  it("true throughout the 28d second-round window", () => {
    const p = baseProfile({ trial_second_round_activated: true });
    expect(isFreeTrialActiveForProfile(p, start + 27 * MS_DAY)).toBe(true);
    expect(isFreeTrialActiveForProfile(p, start + 28 * MS_DAY)).toBe(false);
  });

  it("false when the bonus was already claimed", () => {
    expect(
      isFreeTrialActiveForProfile(
        baseProfile({ trial_end_bonus_activated: true }),
        start + 5 * MS_DAY
      )
    ).toBe(false);
  });

  it("false for a profile that was never activated", () => {
    expect(
      isFreeTrialActiveForProfile(
        { free_trial_activated: false, trial_second_round_activated: false },
        Date.now()
      )
    ).toBe(false);
  });
});
