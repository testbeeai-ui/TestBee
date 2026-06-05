import { describe, expect, it } from "vitest";
import {
  getFreePlanMaxMonths,
  getFreePlanMonthsElapsed,
  getFreePlanStartedAtMs,
  isFreePlanCapExceeded,
  shouldBlockMocksForFreePlanCap,
} from "@/lib/subscription/freePlanCap";
import { SUBSCRIPTION_CONFIG_DEFAULTS } from "@/lib/subscription/subscriptionConfig";

const MS_DAY = 24 * 60 * 60 * 1000;

function freeProfile(overrides: Record<string, unknown> = {}) {
  return {
    plan_tier: "free",
    free_trial_activated: true,
    free_trial_activated_at: "2026-06-01T00:00:00.000Z",
    trial_second_round_activated: false,
    trial_original_ended_at: "2026-06-15T00:00:00.000Z", // 14 days after activation
    created_at: "2026-06-01T00:00:00.000Z",
    time_travel_offset_ms: 0,
    ...overrides,
  };
}

describe("freePlanCap config", () => {
  it("defaults to 2 months", () => {
    expect(SUBSCRIPTION_CONFIG_DEFAULTS.free_plan_max_months).toBe(2);
    expect(getFreePlanMaxMonths()).toBe(2);
  });

  it("reads admin override", () => {
    expect(getFreePlanMaxMonths({ free_plan_max_months: 6 })).toBe(6);
  });

  it("falls back to default on invalid config", () => {
    expect(getFreePlanMaxMonths({ free_plan_max_months: 0 })).toBe(2);
    expect(getFreePlanMaxMonths({ free_plan_max_months: -1 })).toBe(2);
  });
});

describe("getFreePlanStartedAtMs", () => {
  it("prefers trial_original_ended_at when set", () => {
    const p = freeProfile();
    expect(getFreePlanStartedAtMs(p)).toBe(Date.parse("2026-06-15T00:00:00.000Z"));
  });

  it("falls back to trial activation + 14 days when missing", () => {
    const p = freeProfile({ trial_original_ended_at: null });
    expect(getFreePlanStartedAtMs(p)).toBe(
      Date.parse("2026-06-01T00:00:00.000Z") + 14 * MS_DAY
    );
  });

  it("falls back to trial activation + 28 days when second round active", () => {
    const p = freeProfile({
      trial_original_ended_at: null,
      trial_second_round_activated: true,
    });
    expect(getFreePlanStartedAtMs(p)).toBe(
      Date.parse("2026-06-01T00:00:00.000Z") + 28 * MS_DAY
    );
  });

  it("returns null when there is no trial anchor", () => {
    const p = freeProfile({
      trial_original_ended_at: null,
      free_trial_activated_at: null,
      free_trial_activated: false,
      created_at: null,
    });
    expect(getFreePlanStartedAtMs(p)).toBeNull();
  });
});

describe("getFreePlanMonthsElapsed", () => {
  it("0 months immediately after trial ends", () => {
    const p = freeProfile();
    const now = Date.parse("2026-06-15T00:00:00.000Z") + MS_DAY;
    expect(getFreePlanMonthsElapsed(p, null, now)).toBe(0);
  });

  it("1 month ~30 days after trial ends", () => {
    const p = freeProfile();
    const now = Date.parse("2026-06-15T00:00:00.000Z") + 30 * MS_DAY;
    expect(getFreePlanMonthsElapsed(p, null, now)).toBe(1);
  });

  it("2 months ~60 days after trial ends", () => {
    const p = freeProfile();
    const now = Date.parse("2026-06-15T00:00:00.000Z") + 60 * MS_DAY;
    expect(getFreePlanMonthsElapsed(p, null, now)).toBe(2);
  });

  it("0 months for a user who never had a trial", () => {
    const p = freeProfile({
      trial_original_ended_at: null,
      free_trial_activated_at: null,
      free_trial_activated: false,
      created_at: null,
    });
    expect(getFreePlanMonthsElapsed(p, null, Date.now())).toBe(0);
  });
});

describe("isFreePlanCapExceeded", () => {
  it("false when on trial tier", () => {
    const p = freeProfile({ plan_tier: "free_trial" });
    const now = Date.parse("2026-06-15T00:00:00.000Z") + 90 * MS_DAY;
    expect(isFreePlanCapExceeded(p, null, now)).toBe(false);
  });

  it("false on Free plan with 1 month elapsed", () => {
    const p = freeProfile();
    const now = Date.parse("2026-06-15T00:00:00.000Z") + 30 * MS_DAY;
    expect(isFreePlanCapExceeded(p, null, now)).toBe(false);
  });

  it("true on Free plan with 2+ months elapsed (default cap = 2)", () => {
    const p = freeProfile();
    const now = Date.parse("2026-06-15T00:00:00.000Z") + 60 * MS_DAY;
    expect(isFreePlanCapExceeded(p, null, now)).toBe(true);
  });

  it("respects admin-configured cap of 6 months", () => {
    const p = freeProfile();
    const now = Date.parse("2026-06-15T00:00:00.000Z") + 60 * MS_DAY;
    expect(isFreePlanCapExceeded(p, { free_plan_max_months: 6 }, now)).toBe(false);
    const now6 = Date.parse("2026-06-15T00:00:00.000Z") + 180 * MS_DAY;
    expect(isFreePlanCapExceeded(p, { free_plan_max_months: 6 }, now6)).toBe(true);
  });

  it("false on Starter plan regardless of duration", () => {
    const p = freeProfile({ plan_tier: "starter" });
    const now = Date.parse("2026-06-15T00:00:00.000Z") + 365 * MS_DAY;
    expect(isFreePlanCapExceeded(p, null, now)).toBe(false);
  });
});

describe("shouldBlockMocksForFreePlanCap", () => {
  it("false on Free plan with 1 month elapsed", () => {
    const p = freeProfile();
    const now = Date.parse("2026-06-15T00:00:00.000Z") + 30 * MS_DAY;
    expect(shouldBlockMocksForFreePlanCap(p, "free", null, now)).toBe(false);
  });

  it("true on Free plan with 2+ months elapsed", () => {
    const p = freeProfile();
    const now = Date.parse("2026-06-15T00:00:00.000Z") + 60 * MS_DAY;
    expect(shouldBlockMocksForFreePlanCap(p, "free", null, now)).toBe(true);
  });

  it("false on Starter plan even with time-travel past cap", () => {
    const p = freeProfile({ plan_tier: "starter" });
    const now = Date.parse("2026-06-15T00:00:00.000Z") + 365 * MS_DAY;
    expect(shouldBlockMocksForFreePlanCap(p, "starter", null, now)).toBe(false);
  });

  it("applies dev time-travel offset", () => {
    const p = freeProfile({ time_travel_offset_ms: 60 * MS_DAY });
    const now = Date.parse("2026-06-15T00:00:00.000Z");
    expect(shouldBlockMocksForFreePlanCap(p, "free", null, now)).toBe(true);
  });
});
