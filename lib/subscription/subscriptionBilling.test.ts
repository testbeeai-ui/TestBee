import { describe, expect, it } from "vitest";
import {
  computePaidSubscriptionPeriod,
  resolveBillingCycle,
  TRIAL_END_BONUS_MONTH_DAYS,
  BILLING_CYCLE_PERIOD_DAYS,
} from "@/lib/subscription/subscriptionBilling";

describe("subscriptionBilling", () => {
  it("defaults to monthly 30-day period for paid Pro", () => {
    const started = "2026-06-03T10:00:00.000Z";
    const period = computePaidSubscriptionPeriod(
      {
        plan_tier: "pro",
        subscription_started_at: started,
        created_at: started,
      },
      Date.parse(started) + 5 * 24 * 60 * 60 * 1000
    );
    expect(period?.totalDays).toBe(BILLING_CYCLE_PERIOD_DAYS.monthly);
    expect(period?.billingRateLabel).toContain("/ month");
    expect(period?.rawRate).toBe(899);
    expect(period?.remainingDays).toBe(25);
  });

  it("uses 30-day bonus month after trial-end card (scenario 2)", () => {
    const started = "2026-06-03T10:00:00.000Z";
    const period = computePaidSubscriptionPeriod(
      {
        plan_tier: "pro",
        trial_end_bonus_activated: true,
        trial_second_round_activated: false,
        card_added_at: started,
        subscription_started_at: started,
      },
      Date.parse(started)
    );
    expect(period?.totalDays).toBe(TRIAL_END_BONUS_MONTH_DAYS);
    expect(period?.inBonusMonth).toBe(true);
    expect(period?.billingRateLabel).toBe("₹899 / month");
  });

  it("bonus month starts at calendar day 14 even if card_added_at was saved too early", () => {
    const trialStart = "2026-06-03T10:00:00.000Z";
    const trialEndMs = Date.parse(trialStart) + 14 * 24 * 60 * 60 * 1000;
    const period = computePaidSubscriptionPeriod(
      {
        plan_tier: "pro",
        free_trial_activated_at: trialStart,
        free_trial_activated: true,
        trial_end_bonus_activated: true,
        trial_second_round_activated: false,
        card_added_at: trialStart,
        subscription_started_at: trialStart,
        trial_original_ended_at: trialStart,
      },
      trialEndMs + 60_000
    );
    expect(period?.startMs).toBe(trialEndMs);
    expect(period?.remainingDays).toBe(30);
    expect(period?.totalDays).toBe(30);
  });

  it("reads annual cycle from stored payment details", () => {
    expect(
      resolveBillingCycle({
        payment_card_details: { billingCycle: "annual", planSelected: "pro" },
      })
    ).toBe("annual");
    const period = computePaidSubscriptionPeriod({
      plan_tier: "pro",
      subscription_started_at: "2026-01-01T00:00:00.000Z",
      payment_card_details: { billingCycle: "annual" },
    });
    expect(period?.totalDays).toBe(365);
    expect(period?.billingRateLabel).toContain("/ year");
  });
});
