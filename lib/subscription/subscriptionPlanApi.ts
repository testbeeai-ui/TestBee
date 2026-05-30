import { getClientApiAuthHeaders } from "@/lib/auth/clientApiAuth";
import type { SubscriptionPlanKey } from "@/lib/subscription/subscriptionConfig";

export async function setUserSubscriptionPlan(plan: SubscriptionPlanKey): Promise<void> {
  const authHeaders = await getClientApiAuthHeaders();
  const res = await fetch("/api/user/subscription/set-plan", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
    },
    body: JSON.stringify({ plan }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || "Failed to switch subscription plan");
  }
}
