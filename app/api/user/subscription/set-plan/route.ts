import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { enforceSameOriginForCookieAuth } from "@/lib/auth/securityGuards";
import type { SubscriptionPlanKey } from "@/lib/subscription/subscriptionConfig";

type Body = {
  plan?: SubscriptionPlanKey | string;
};

const ALLOWED: SubscriptionPlanKey[] = ["free_trial", "free", "starter", "pro"];

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
 * Testing-mode plan switcher.
 * No payment gateway check here; user can switch between Free / Free Trial / Starter / Pro.
 */
export async function POST(request: Request) {
  try {
    const csrf = enforceSameOriginForCookieAuth(request);
    if (csrf) return csrf;

    const ctx = await getSupabaseAndUser(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { supabase, user } = ctx;
    const body = (await request.json().catch(() => ({}))) as Body;
    const requested = normalizePlan(body.plan);
    if (!requested || !ALLOWED.includes(requested)) {
      return NextResponse.json(
        { error: "Invalid plan. Use free_trial, free, starter, or pro." },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();
    const { data: profile, error: readErr } = await supabase
      .from("profiles")
      .select("subscription_started_at")
      .eq("id", user.id)
      .maybeSingle();

    if (readErr) {
      return NextResponse.json({ error: readErr.message }, { status: 500 });
    }
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = {
      plan_tier: requested,
    };

    if (requested === "free_trial") {
      updates.free_trial_activated = true;
      updates.free_trial_activated_at = nowIso;
    } else {
      updates.free_trial_activated = false;
      updates.free_trial_activated_at = null;
      updates.subscription_started_at =
        requested === "starter" || requested === "pro"
          ? profile.subscription_started_at ?? nowIso
          : null;
    }

    const { error } = await supabase.from("profiles").update(updates).eq("id", user.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, plan: requested });
  } catch (e) {
    console.error("set-plan POST error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
