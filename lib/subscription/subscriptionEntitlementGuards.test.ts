import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizePlanTier } from "@/lib/subscription/subscriptionConfig";
import {
  isSelfServicePlanSwitchAllowed,
  normalizePlanSwitchRequest,
} from "@/lib/subscription/selfServicePlanSwitch";

describe("self-service subscription switches", () => {
  it("allows only Free from the self-service switcher", () => {
    expect(normalizePlanSwitchRequest("free")).toBe("free");
    expect(normalizePlanSwitchRequest("starter")).toBe("starter");
    expect(normalizePlanSwitchRequest("pro")).toBe("pro");
    expect(normalizePlanSwitchRequest("free_trial")).toBe("free_trial");

    expect(isSelfServicePlanSwitchAllowed("free")).toBe(true);
    expect(isSelfServicePlanSwitchAllowed("free_trial")).toBe(false);
    expect(isSelfServicePlanSwitchAllowed("starter")).toBe(false);
    expect(isSelfServicePlanSwitchAllowed("pro")).toBe(false);
  });
});

describe("subscription entitlement expiry", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("downgrades expired paid coupon grants to Free", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-06T12:00:00.000Z"));

    expect(
      normalizePlanTier("pro", false, {
        subscription_started_at: "2026-05-01T00:00:00.000Z",
        subscription_expires_at: "2026-06-06T11:59:59.000Z",
        payment_card_details: { type: "coupon", autoRenew: false },
      })
    ).toBe("free");
  });

  it("keeps unexpired paid coupon grants active", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-06T12:00:00.000Z"));

    expect(
      normalizePlanTier("starter", false, {
        subscription_started_at: "2026-06-01T00:00:00.000Z",
        subscription_expires_at: "2026-07-01T00:00:00.000Z",
        payment_card_details: { type: "coupon", autoRenew: false },
      })
    ).toBe("starter");
  });
});
