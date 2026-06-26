import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { createAdminClient } from "@/integrations/supabase/server";
import { enforceSameOriginForCookieAuth } from "@/lib/auth/securityGuards";
import {
  computeTeacherCheckoutSummary,
  teacherPlanExpiresAtIso,
  type PaidTeacherPlan,
} from "@/lib/subscription/teacherCheckoutSummary";
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
};

function parsePlan(raw: unknown): PaidTeacherPlan | null {
  const v = String(raw ?? "").trim().toLowerCase();
  return v === "starter" || v === "pro" ? v : null;
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

    const { data: profileRow } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profileRow?.role !== "teacher") {
      return NextResponse.json({ error: "Teachers only" }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as Body;
    const razorpay_order_id = String(body.razorpay_order_id ?? "").trim();
    const razorpay_payment_id = String(body.razorpay_payment_id ?? "").trim();
    const razorpay_signature = String(body.razorpay_signature ?? "").trim();
    const plan = parsePlan(body.plan);

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: "Missing Razorpay payment fields" }, { status: 400 });
    }
    if (!plan) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const valid = verifyRazorpayPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      keySecret
    );
    if (!valid) {
      return NextResponse.json({ error: "Invalid payment signature" }, { status: 400 });
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }

    const { data: existingProfile } = await admin
      .from("profiles")
      .select("payment_card_details")
      .eq("id", user.id)
      .maybeSingle();

    const existingDetails =
      existingProfile?.payment_card_details &&
      typeof existingProfile.payment_card_details === "object"
        ? (existingProfile.payment_card_details as Record<string, unknown>)
        : null;

    if (
      existingDetails?.teacher_razorpay_order_id === razorpay_order_id &&
      existingDetails?.teacher_razorpay_payment_id === razorpay_payment_id
    ) {
      return NextResponse.json({ ok: true, plan, alreadyProcessed: true });
    }

    const summary = computeTeacherCheckoutSummary(plan);
    const nowIso = new Date().toISOString();

    const { error: updateError } = await (admin as any)
      .from("profiles")
      .update({
        teacher_plan_tier: plan,
        teacher_plan_started_at: nowIso,
        teacher_plan_expires_at: teacherPlanExpiresAtIso(),
        payment_card_details: {
          ...(existingDetails ?? {}),
          type: "teacher_razorpay",
          teacher_plan: plan,
          teacher_razorpay_order_id: razorpay_order_id,
          teacher_razorpay_payment_id: razorpay_payment_id,
          teacher_amount_paise: summary.amountPaise,
          teacher_paid_at: nowIso,
          teacher_auto_renew: true,
        },
      })
      .eq("id", user.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, plan });
  } catch (e) {
    console.error("teacher activate-after-payment error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
