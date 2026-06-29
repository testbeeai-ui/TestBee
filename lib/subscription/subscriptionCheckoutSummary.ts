import {
  BILLING_CYCLE_PERIOD_DAYS,
  PLAN_PRICING,
  type BillingCycle,
} from "@/lib/subscription/subscriptionBilling";

const SCHOLAR_CREDIT_INR: Record<BillingCycle, number> = {
  monthly: 100,
  annual: 1000,
};

const GST_RATE = 0.18;

export type PaidSubscriptionPlan = "starter" | "pro";

export type SubscriptionCheckoutSummary = {
  plan: PaidSubscriptionPlan;
  billingCycle: BillingCycle;
  baseInr: number;
  creditInr: number;
  gstInr: number;
  totalInr: number;
  amountPaise: number;
};

export function computeSubscriptionCheckoutSummary(
  plan: PaidSubscriptionPlan,
  billingCycle: BillingCycle,
): SubscriptionCheckoutSummary {
  const baseInr = PLAN_PRICING[plan][billingCycle];
  const creditInr = SCHOLAR_CREDIT_INR[billingCycle];
  const subtotalInr = baseInr - creditInr;
  const gstInr = Math.round(subtotalInr * GST_RATE);
  const totalInr = subtotalInr + gstInr;
  const amountPaise = totalInr * 100;

  return {
    plan,
    billingCycle,
    baseInr,
    creditInr,
    gstInr,
    totalInr,
    amountPaise,
  };
}

export function subscriptionExpiresAtIso(
  billingCycle: BillingCycle,
  fromMs = Date.now(),
): string {
  const days = BILLING_CYCLE_PERIOD_DAYS[billingCycle];
  return new Date(fromMs + days * 24 * 60 * 60 * 1000).toISOString();
}

export {
  TEACHER_RDM_PACKS,
  teacherRdmPackAmountPaise as rdmPackAmountPaise,
} from "@/lib/subscription/teacherRdmPacks";
