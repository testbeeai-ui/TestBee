import { describe, expect, it } from "vitest";
import { TRIAL_END_BONUS_MONTH_DAYS } from "@/lib/subscription/subscriptionBilling";
import {
  TRIAL_END_BONUS_CLAIM_WINDOW_MS,
  buildClaimBonusDecision,
  decideStudentMockAccess,
  expiredBonusMonthProfileUpdates,
  isBonusMonthExpired,
  isTrialChoiceRequired,
  resolveTrialExpirationGateOpen,
  sanitizePaymentDetailsForStorage,
  type TrialAccessProfile,
} from "@/lib/subscription/trialLifecycle";

const MS_DAY = 24 * 60 * 60 * 1000;
const ACTIVATED = "2026-06-01T10:00:00.000Z";
const START = Date.parse(ACTIVATED);

function trialProfile(overrides: Partial<TrialAccessProfile> = {}): TrialAccessProfile {
  return {
    plan_tier: "free_trial",
    free_trial_activated: true,
    free_trial_activated_at: ACTIVATED,
    created_at: ACTIVATED,
    trial_second_round_activated: false,
    trial_end_bonus_activated: false,
    time_travel_offset_ms: 0,
    ...overrides,
  };
}

describe("resolveTrialExpirationGateOpen", () => {
  it("shows the overlay when the client clock says trial ended, even if a stale server cache says no", () => {
    expect(resolveTrialExpirationGateOpen(true, false)).toBe(true);
  });

  it("shows the overlay when the server says required", () => {
    expect(resolveTrialExpirationGateOpen(false, true)).toBe(true);
  });

  it("hides the overlay when neither clock requires it", () => {
    expect(resolveTrialExpirationGateOpen(false, false)).toBe(false);
    expect(resolveTrialExpirationGateOpen(false, null)).toBe(false);
  });
});

describe("isTrialChoiceRequired", () => {
  it("false during the first 14 days", () => {
    expect(isTrialChoiceRequired(trialProfile(), START + 13 * MS_DAY)).toBe(false);
  });

  it("true at day 14 if they have not chosen", () => {
    expect(isTrialChoiceRequired(trialProfile(), START + 14 * MS_DAY)).toBe(true);
  });

  it("false during the extra 14 days after second round (no bonus flag)", () => {
    const p = trialProfile({ trial_second_round_activated: true });
    expect(isTrialChoiceRequired(p, START + 27 * MS_DAY)).toBe(false);
    expect(isTrialChoiceRequired(p, START + 28 * MS_DAY)).toBe(true);
  });

  it("true at day 28 for leftover bonus+second-round stuck on free_trial", () => {
    const p = trialProfile({
      trial_second_round_activated: true,
      trial_end_bonus_activated: true,
    });
    expect(isTrialChoiceRequired(p, START + 28 * MS_DAY + 60_000)).toBe(true);
  });

  it("false after Continue on Free", () => {
    const p = trialProfile({
      plan_tier: "free",
      free_trial_activated: false,
      trial_original_ended_at: new Date(START + 14 * MS_DAY).toISOString(),
    });
    expect(isTrialChoiceRequired(p, START + 20 * MS_DAY)).toBe(false);
  });

  it("false during an unexpired starter bonus month", () => {
    const started = new Date(START + 14 * MS_DAY).toISOString();
    const expires = new Date(START + 44 * MS_DAY).toISOString();
    const p = trialProfile({
      plan_tier: "starter",
      free_trial_activated: false,
      trial_end_bonus_activated: true,
      subscription_started_at: started,
      subscription_expires_at: expires,
      card_added_at: started,
      trial_original_ended_at: started,
    });
    expect(isTrialChoiceRequired(p, START + 20 * MS_DAY)).toBe(false);
  });
});

describe("buildClaimBonusDecision", () => {
  it("refuses before the trial clock ends", () => {
    const result = buildClaimBonusDecision({
      selectedPlan: "starter",
      nowMs: START + 10 * MS_DAY,
      hasStreakBonus: false,
      profile: trialProfile(),
    });
    expect(result.kind).toBe("too_early");
  });

  it("streak path unlocks extra 14 days and does not mark the paid bonus or store a card", () => {
    const result = buildClaimBonusDecision({
      selectedPlan: "pro",
      nowMs: START + 14 * MS_DAY + 60_000,
      hasStreakBonus: true,
      profile: trialProfile(),
    });
    expect(result.kind).toBe("apply");
    if (result.kind !== "apply") return;
    expect(result.scenario).toBe(1);
    expect(result.updates.plan_tier).toBe("free_trial");
    expect(result.updates.trial_second_round_activated).toBe(true);
    expect(result.updates.trial_end_bonus_activated).toBe(false);
    const details = result.updates.payment_card_details as Record<string, unknown>;
    expect(details.cardNumber).toBeUndefined();
    expect(details.cvv).toBeUndefined();
    expect(details.type).toBe("deferred_razorpay");
  });

  it("no-streak path starts a 30-day bonus month with an expiry and no PAN/CVV", () => {
    const nowMs = START + 14 * MS_DAY + 60_000;
    const result = buildClaimBonusDecision({
      selectedPlan: "starter",
      nowMs,
      hasStreakBonus: false,
      profile: trialProfile(),
    });
    expect(result.kind).toBe("apply");
    if (result.kind !== "apply") return;
    expect(result.scenario).toBe(2);
    expect(result.updates.plan_tier).toBe("starter");
    expect(result.updates.free_trial_activated).toBe(false);
    expect(result.updates.trial_end_bonus_activated).toBe(true);
    expect(result.updates.trial_second_round_activated).toBe(false);
    const expires = Date.parse(String(result.updates.subscription_expires_at));
    expect(expires - nowMs).toBe(TRIAL_END_BONUS_MONTH_DAYS * MS_DAY);
    const details = result.updates.payment_card_details as Record<string, unknown>;
    expect(details.cardNumber).toBeUndefined();
    expect(details.cvv).toBeUndefined();
  });

  it("closes the 1-month bonus if they wait more than 24 hours after trial end", () => {
    const result = buildClaimBonusDecision({
      selectedPlan: "starter",
      nowMs: START + 14 * MS_DAY + TRIAL_END_BONUS_CLAIM_WINDOW_MS + 1,
      hasStreakBonus: false,
      profile: trialProfile(),
    });
    expect(result.kind).toBe("bonus_window_closed");
  });

  it("does not grant extra weeks after the 28-day window has already passed", () => {
    const result = buildClaimBonusDecision({
      selectedPlan: "starter",
      nowMs: START + 29 * MS_DAY,
      hasStreakBonus: true,
      profile: trialProfile(),
    });
    expect(result.kind).toBe("bonus_window_closed");
  });

  it("treats an already-paid bonus month as already claimed", () => {
    const result = buildClaimBonusDecision({
      selectedPlan: "pro",
      nowMs: START + 20 * MS_DAY,
      hasStreakBonus: false,
      profile: trialProfile({
        plan_tier: "starter",
        free_trial_activated: false,
        trial_end_bonus_activated: true,
        subscription_expires_at: new Date(START + 44 * MS_DAY).toISOString(),
      }),
    });
    expect(result.kind).toBe("already_claimed");
  });
});

describe("bonus month expiry", () => {
  it("expires starter bonus month after 30 days", () => {
    const started = new Date(START + 14 * MS_DAY).toISOString();
    const p = trialProfile({
      plan_tier: "starter",
      free_trial_activated: false,
      trial_end_bonus_activated: true,
      trial_second_round_activated: false,
      subscription_started_at: started,
      subscription_expires_at: new Date(START + 44 * MS_DAY).toISOString(),
      card_added_at: started,
    });
    expect(isBonusMonthExpired(p, START + 43 * MS_DAY)).toBe(false);
    expect(isBonusMonthExpired(p, START + 44 * MS_DAY)).toBe(true);
    expect(expiredBonusMonthProfileUpdates()).toEqual({
      plan_tier: "free",
      free_trial_activated: false,
      trial_second_round_activated: false,
    });
  });
});

describe("sanitizePaymentDetailsForStorage", () => {
  it("drops card number and CVV", () => {
    const stored = sanitizePaymentDetailsForStorage(
      {
        cardNumber: "4111111111111111",
        cvv: "123",
        cardholderName: "A Student",
        expiryDate: "12/28",
      },
      "pro"
    );
    expect(stored.cardNumber).toBeUndefined();
    expect(stored.cvv).toBeUndefined();
    expect(stored.cardholderName).toBeUndefined();
    expect(stored.planSelected).toBe("pro");
    expect(stored.type).toBe("deferred_razorpay");
  });
});

describe("decideStudentMockAccess", () => {
  it("allows a mock during an active trial", () => {
    const decision = decideStudentMockAccess(trialProfile(), START + 5 * MS_DAY);
    expect(decision.allow).toBe(true);
  });

  it("blocks a mock when trial ended and they have not chosen", () => {
    const decision = decideStudentMockAccess(trialProfile(), START + 14 * MS_DAY);
    expect(decision).toMatchObject({ allow: false, code: "TRIAL_CHOICE_REQUIRED" });
  });

  it("blocks a mock after the Free plan 2-month cap", () => {
    const p = trialProfile({
      plan_tier: "free",
      free_trial_activated: false,
      trial_original_ended_at: new Date(START + 14 * MS_DAY).toISOString(),
    });
    const decision = decideStudentMockAccess(p, START + 14 * MS_DAY + 60 * MS_DAY);
    expect(decision).toMatchObject({ allow: false, code: "FREE_PLAN_MOCK_CAP" });
  });

  it("downgrades an expired bonus month then applies the Free cap if it is already past 2 months", () => {
    const started = new Date(START + 14 * MS_DAY).toISOString();
    const p = trialProfile({
      plan_tier: "starter",
      free_trial_activated: false,
      trial_end_bonus_activated: true,
      trial_original_ended_at: started,
      subscription_started_at: started,
      subscription_expires_at: new Date(START + 44 * MS_DAY).toISOString(),
      card_added_at: started,
    });
    const decision = decideStudentMockAccess(p, START + 14 * MS_DAY + 90 * MS_DAY);
    expect(decision.allow).toBe(false);
    expect(decision.persist).toMatchObject({ plan_tier: "free" });
  });
});
