import { TEACHER_PLAN_PRICING_INR } from "@/lib/teacherPortal/teacherPlan";
import { subscriptionExpiresAtIso } from "@/lib/subscription/subscriptionCheckoutSummary";
import type { BillingCycle } from "@/lib/subscription/subscriptionBilling";

const GST_RATE = 0.18;

export type PaidTeacherPlan = "starter" | "pro";

export type TeacherCheckoutSummary = {
  plan: PaidTeacherPlan;
  billingCycle: BillingCycle;
  baseInr: number;
  gstInr: number;
  totalInr: number;
  amountPaise: number;
};

export function computeTeacherCheckoutSummary(
  plan: PaidTeacherPlan,
  billingCycle: BillingCycle = "monthly"
): TeacherCheckoutSummary {
  if (billingCycle !== "monthly") {
    throw new Error("Teacher subscriptions are monthly only");
  }
  const baseInr = TEACHER_PLAN_PRICING_INR[plan];
  const gstInr = Math.round(baseInr * GST_RATE);
  const totalInr = baseInr + gstInr;
  return {
    plan,
    billingCycle,
    baseInr,
    gstInr,
    totalInr,
    amountPaise: totalInr * 100,
  };
}

export function teacherPlanExpiresAtIso(fromMs = Date.now()): string {
  return subscriptionExpiresAtIso("monthly", fromMs);
}
