import { describe, expect, it } from "vitest";
import {
  shouldAutoOpenOnboardingRewardDialog,
  shouldShowTrialExpirationOverlay,
} from "@/lib/subscription/dashboardTrialPopups";
import { getDashboardPopupPhase } from "@/lib/subscription/freeTrialClient";
import {
  isFreeTrialPeriodEndedForProfile,
} from "@/lib/subscription/freeTrialTimer";
import {
  getTrialTrackerDaysCompleted,
  qualifiesForTrialExtensionBonus,
  TRIAL_EXTENSION_TRACKER_DAYS_REQUIRED,
} from "@/lib/onboarding/dailyStreakProgress";
import type { OnboardingProfileFields } from "@/lib/subscription/freeTrialClient";
import { ONBOARDING_REWARD_TASK_IDS } from "@/lib/subscription/onboardingRewardConstants";

const MS_DAY = 24 * 60 * 60 * 1000;
const ACTIVATED = "2026-06-01T10:00:00.000Z";

function baseProfile(overrides: Partial<OnboardingProfileFields> = {}): OnboardingProfileFields {
  return {
    plan_tier: "free_trial",
    free_trial_activated: true,
    free_trial_activated_at: ACTIVATED,
    trial_end_bonus_activated: false,
    trial_second_round_activated: false,
    time_travel_offset_ms: 0,
    onboarding_reward_claimed_at: null,
    onboarding_reward_progress: {},
    ...overrides,
  };
}

function nowAtDay(day: number): number {
  return Date.parse(ACTIVATED) + day * MS_DAY;
}

describe("popup priority matrix", () => {
  it("A: trial not activated → free_trial promo only", () => {
    const profile = baseProfile({
      plan_tier: "free",
      free_trial_activated: false,
      free_trial_activated_at: null,
    });
    const now = nowAtDay(0);
    expect(getDashboardPopupPhase(profile, "u1")).toBe("free_trial");
    expect(shouldShowTrialExpirationOverlay(profile, now)).toBe(false);
    expect(shouldAutoOpenOnboardingRewardDialog(profile, now, "u1")).toBe(false);
  });

  it("B: day 1, not claimed → onboarding (Day 1 checklist)", () => {
    const profile = baseProfile();
    const now = nowAtDay(1);
    expect(getDashboardPopupPhase(profile, "u1")).toBe("onboarding");
    expect(shouldShowTrialExpirationOverlay(profile, now)).toBe(false);
    expect(shouldAutoOpenOnboardingRewardDialog(profile, now, "u1")).toBe(true);
  });

  it("C: day 14+, bonus not claimed → card overlay (trial_expiration)", () => {
    const targetNow = nowAtDay(14) + 60_000;
    const profile = baseProfile({
      time_travel_offset_ms: targetNow - Date.now(),
    });
    expect(getDashboardPopupPhase(profile, "u1")).toBe("trial_expiration");
    expect(shouldShowTrialExpirationOverlay(profile, targetNow)).toBe(true);
    expect(shouldAutoOpenOnboardingRewardDialog(profile, targetNow, "u1")).toBe(false);
  });

  it("D: day 14+ but bonus already claimed → no overlays", () => {
    const profile = baseProfile({ trial_end_bonus_activated: true });
    const now = nowAtDay(14) + 60_000;
    expect(getDashboardPopupPhase(profile, "u1")).toBe("none");
    expect(shouldShowTrialExpirationOverlay(profile, now)).toBe(false);
    expect(shouldAutoOpenOnboardingRewardDialog(profile, now, "u1")).toBe(false);
  });

  it("H: card submitted → Starter plan must not reopen free-trial activation promo", () => {
    const profile = baseProfile({
      plan_tier: "starter",
      free_trial_activated: true,
      trial_end_bonus_activated: true,
      trial_original_ended_at: new Date(nowAtDay(14)).toISOString(),
      subscription_started_at: new Date(nowAtDay(14)).toISOString(),
    });
    expect(getDashboardPopupPhase(profile, "u1")).toBe("none");
  });

  it("I: continued on Free via exit-trial → gate closes", () => {
    const now = nowAtDay(14) + 60_000;
    const profile = baseProfile({
      plan_tier: "free",
      free_trial_activated: false,
      trial_original_ended_at: new Date(now).toISOString(),
    });
    expect(shouldShowTrialExpirationOverlay(profile, now)).toBe(false);
  });

  it("K: plan_tier free_trial + day 14 shows gate (no hadActiveFreeTrialTrack)", () => {
    const now = nowAtDay(14) + 60_000;
    const profile = baseProfile({
      plan_tier: "free_trial",
      free_trial_activated: true,
    });
    expect(shouldShowTrialExpirationOverlay(profile, now)).toBe(true);
  });

  it("J: trial_original_ended_at alone on free_trial tier does not skip gate", () => {
    const now = nowAtDay(14) + 60_000;
    const profile = baseProfile({
      plan_tier: "free_trial",
      free_trial_activated: true,
      trial_original_ended_at: new Date(now).toISOString(),
      time_travel_offset_ms: now - Date.now(),
    });
    expect(shouldShowTrialExpirationOverlay(profile, now)).toBe(true);
  });

  it("E: checklist complete, not claimed, mid-trial → claim_reward", () => {
    const allDone = Object.fromEntries(
      ONBOARDING_REWARD_TASK_IDS.map((id) => [id, true])
    ) as Record<string, boolean>;
    allDone.gyan_browse = true;
    allDone.gyan_post = true;
    allDone.gyan_engagement = true;
    const profile = baseProfile({ onboarding_reward_progress: allDone });
    const now = nowAtDay(5);
    expect(getDashboardPopupPhase(profile, "u1")).toBe("claim_reward");
    expect(shouldAutoOpenOnboardingRewardDialog(profile, now, "u1")).toBe(false);
  });

  it("F: day 14 beats claim_reward and onboarding", () => {
    const partial = { magic_wall: true, lessons: true };
    const targetNow = nowAtDay(15);
    const profile = baseProfile({
      onboarding_reward_progress: partial,
      onboarding_reward_claimed_at: null,
      time_travel_offset_ms: targetNow - Date.now(),
    });
    expect(getDashboardPopupPhase(profile, "u1")).toBe("trial_expiration");
  });

  it("G: second round active → no auto onboarding (extension path)", () => {
    const profile = baseProfile({
      trial_second_round_activated: true,
      trial_end_bonus_activated: true,
    });
    const now = nowAtDay(20);
    expect(shouldAutoOpenOnboardingRewardDialog(profile, now, "u1")).toBe(false);
  });

  it("H: time-travel offset reaches day 14 on client clock", () => {
    const profile = baseProfile({
      time_travel_offset_ms: nowAtDay(14) + 60_000 - Date.now(),
    });
    const popupNow = Date.now() + (profile.time_travel_offset_ms ?? 0);
    expect(shouldShowTrialExpirationOverlay(profile, popupNow)).toBe(true);
  });
});

describe("trial period length", () => {
  it("ends at 14 days (first round)", () => {
    expect(isFreeTrialPeriodEndedForProfile(baseProfile(), nowAtDay(14))).toBe(true);
    expect(isFreeTrialPeriodEndedForProfile(baseProfile(), nowAtDay(13))).toBe(false);
  });

  it("ends at 28 days when second round active", () => {
    const profile = baseProfile({ trial_second_round_activated: true });
    expect(isFreeTrialPeriodEndedForProfile(profile, nowAtDay(27))).toBe(false);
    expect(isFreeTrialPeriodEndedForProfile(profile, nowAtDay(28))).toBe(true);
  });
});

describe("claim-bonus scenario track days", () => {
  it(`extension requires ${TRIAL_EXTENSION_TRACKER_DAYS_REQUIRED} track days`, () => {
    expect(
      qualifiesForTrialExtensionBonus("user-1", "2026-06-01T10:00:00.000Z", {})
    ).toBe(false);
    expect(getTrialTrackerDaysCompleted("user-1", "2026-06-01T10:00:00.000Z", {})).toBe(1);
  });
});

describe("mutual exclusion", () => {
  it("never shows card and Day 1 auto-open together", () => {
    const profile = baseProfile();
    for (const day of [0, 1, 7, 13, 14, 20]) {
      const now = nowAtDay(day) + (day >= 14 ? 60_000 : 0);
      const card = shouldShowTrialExpirationOverlay(profile, now);
      const day1 = shouldAutoOpenOnboardingRewardDialog(profile, now, "u1");
      expect(card && day1).toBe(false);
    }
  });
});
