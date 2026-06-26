import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { createAdminClient } from "@/integrations/supabase/server";
import { enforceSameOriginForCookieAuth } from "@/lib/auth/securityGuards";
import {
  computeSubscriptionCheckoutSummary,
  subscriptionExpiresAtIso,
  type PaidSubscriptionPlan,
} from "@/lib/subscription/subscriptionCheckoutSummary";
import type { BillingCycle } from "@/lib/subscription/subscriptionBilling";
import { parseProfilePaymentDetails } from "@/lib/subscription/subscriptionBilling";
import {
  getRazorpayKeySecret,
  verifyRazorpayPaymentSignature,
} from "@/lib/razorpay/verifyPaymentSignature";

export const runtime = "nodejs";

type Body = {
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
  plan?: string;
  billingCycle?: string;
};

function parsePlan(raw: unknown): PaidSubscriptionPlan | null {
  const v = String(raw ?? "").trim().toLowerCase();
  return v === "starter" || v === "pro" ? v : null;
}

function parseBillingCycle(raw: unknown): BillingCycle | null {
  const v = String(raw ?? "").trim().toLowerCase();
  return v === "monthly" || v === "annual" ? v : null;
}

export async function POST(request: Request) {
  try {
    const csrf = enforceSameOriginForCookieAuth(request);
    if (csrf) return csrf;

    const keySecret = getRazorpayKeySecret();
    if (!keySecret) {
      return NextResponse.json({ error: "Razorpay credentials not configured" }, { status: 401 });
    }

    const ctx = await getSupabaseAndUser(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { supabase, user } = ctx;
    const body = (await request.json().catch(() => ({}))) as Body;

    const razorpay_order_id = String(body.razorpay_order_id ?? "").trim();
    const razorpay_payment_id = String(body.razorpay_payment_id ?? "").trim();
    const razorpay_signature = String(body.razorpay_signature ?? "").trim();
    const plan = parsePlan(body.plan);
    const billingCycle = parseBillingCycle(body.billingCycle);

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: "Missing Razorpay payment fields" }, { status: 400 });
    }
    if (!plan || !billingCycle) {
      return NextResponse.json({ error: "Invalid plan or billing cycle" }, { status: 400 });
    }

    const valid = verifyRazorpayPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      keySecret,
    );
    if (!valid) {
      return NextResponse.json({ error: "Invalid payment signature" }, { status: 400 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("payment_card_details")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    const existing = parseProfilePaymentDetails(profile?.payment_card_details);
    if (
      existing?.razorpay_order_id === razorpay_order_id &&
      existing?.razorpay_payment_id === razorpay_payment_id
    ) {
      return NextResponse.json({ ok: true, plan, billingCycle, alreadyProcessed: true });
    }

    const summary = computeSubscriptionCheckoutSummary(plan, billingCycle);
    const nowIso = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        plan_tier: plan,
        free_trial_activated: false,
        trial_second_round_activated: false,
        subscription_started_at: nowIso,
        subscription_expires_at: subscriptionExpiresAtIso(billingCycle),
        payment_card_details: {
          type: "razorpay",
          billingCycle,
          planSelected: plan,
          razorpay_order_id,
          razorpay_payment_id,
          amount_paise: summary.amountPaise,
          paid_at: nowIso,
        },
      })
      .eq("id", user.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // If this user was referred by a teacher within the bonus window, grant the
    // teacher the +500 paid bonus. Non-fatal: a failure here must not block activation.
    try {
      const admin = createAdminClient();
      if (admin) {
        await admin.rpc("award_teacher_referral_paid_bonus", { p_referee_id: user.id });
        await admin.rpc("award_classroom_batch_paid_bonus", { p_user_id: user.id });
      }
    } catch (bonusError) {
      console.error("teacher referral / classroom batch paid bonus failed", bonusError);
    }

    return NextResponse.json({ ok: true, plan, billingCycle });
  } catch (e) {
    console.error("activate-after-payment error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
