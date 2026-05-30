import { NextResponse } from "next/server";
import { createAdminClient } from "@/integrations/supabase/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { enforceSameOriginForCookieAuth } from "@/lib/auth/securityGuards";
import type { SubscriptionPlanKey } from "@/lib/subscription/subscriptionConfig";

type Body = {
  plan?: SubscriptionPlanKey | string;
};

const ALLOWED: SubscriptionPlanKey[] = ["free"];

function normalizePlan(raw: unknown): SubscriptionPlanKey | null {
  const plan = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (plan === "free_trial" || plan === "free" || plan === "starter" || plan === "pro") {
    return plan;
  }
  return null;
}

/**
 * Self-service downgrade only.
 * Paid tiers and trial activation must go through verified payment/trial flows.
 */
export async function POST(request: Request) {
  try {
    const csrf = enforceSameOriginForCookieAuth(request);
    if (csrf) return csrf;

    const ctx = await getSupabaseAndUser(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { user } = ctx;
    const body = (await request.json().catch(() => ({}))) as Body;
    const requested = normalizePlan(body.plan);
    if (!requested || !ALLOWED.includes(requested)) {
      return NextResponse.json(
        { error: "Self-service plan switching is only allowed for the Free plan." },
        { status: 403 }
      );
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json(
        { error: "SUPABASE_SERVICE_ROLE_KEY is not set" },
        { status: 500 }
      );
    }

    const updates: Record<string, unknown> = {
      plan_tier: requested,
      free_trial_activated: false,
    };

    const { error } = await admin.from("profiles").update(updates).eq("id", user.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, plan: requested });
  } catch (e) {
    console.error("set-plan POST error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
