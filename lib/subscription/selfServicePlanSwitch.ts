import type { SubscriptionPlanKey } from "@/lib/subscription/subscriptionConfig";

export const SELF_SERVICE_PLAN_SWITCH_ALLOWED: SubscriptionPlanKey[] = ["free"];

export function normalizePlanSwitchRequest(raw: unknown): SubscriptionPlanKey | null {
  const plan = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (plan === "free_trial" || plan === "free" || plan === "starter" || plan === "pro") {
    return plan;
  }
  return null;
}

export function isSelfServicePlanSwitchAllowed(plan: SubscriptionPlanKey): boolean {
  return SELF_SERVICE_PLAN_SWITCH_ALLOWED.includes(plan);
}
