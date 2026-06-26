import { describe, expect, it } from "vitest";
import {
  computeTeacherSubscriptionPeriod,
  isTeacherAutoRenewActive,
} from "@/lib/teacherPortal/teacherSubscriptionBilling";

describe("teacherSubscriptionBilling", () => {
  it("computes remaining days from teacher_plan_expires_at", () => {
    const now = Date.parse("2026-06-01T00:00:00.000Z");
    const period = computeTeacherSubscriptionPeriod(
      {
        teacher_plan_tier: "pro",
        teacher_plan_started_at: "2026-05-01T00:00:00.000Z",
        teacher_plan_expires_at: "2026-07-01T00:00:00.000Z",
        payment_card_details: { type: "teacher_razorpay", teacher_auto_renew: true },
      },
      now
    );
    expect(period?.remainingDays).toBe(30);
    expect(period?.planKey).toBe("pro");
    expect(period?.autoRenewActive).toBe(true);
  });

  it("returns null when plan expired", () => {
    const period = computeTeacherSubscriptionPeriod({
      teacher_plan_tier: "pro",
      teacher_plan_started_at: "2026-01-01T00:00:00.000Z",
      teacher_plan_expires_at: "2026-02-01T00:00:00.000Z",
    });
    expect(period).toBeNull();
  });

  it("coupon grants have no auto-renew", () => {
    expect(
      isTeacherAutoRenewActive(
        {
          teacher_plan_tier: "starter",
          payment_card_details: {},
        },
        "starter"
      )
    ).toBe(false);
  });
});
