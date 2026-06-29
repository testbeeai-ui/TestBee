import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { enforceSameOriginForCookieAuth } from "@/lib/auth/securityGuards";
import { createAdminClient } from "@/integrations/supabase/server";
import { generateSubscriptionCouponCode } from "@/lib/subscription/subscriptionCouponUtils";
import {
  applyPurchasedCouponRdmCredit,
  type PurchasedCouponRow,
} from "@/lib/teacherPortal/creditTeacherRdmBalance";
import {
  teacherRdmPackAmountPaise,
  teacherRdmPackById,
} from "@/lib/subscription/teacherRdmPacks";
import {
  getRazorpayKeySecret,
  verifyRazorpayPaymentSignature,
} from "@/lib/razorpay/verifyPaymentSignature";

export async function POST(request: Request) {
  try {
    const csrf = enforceSameOriginForCookieAuth(request);
    if (csrf) return csrf;

    const ctx = await getSupabaseAndUser(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const keySecret = getRazorpayKeySecret();
    if (!keySecret) {
      return NextResponse.json({ error: "Razorpay credentials not configured" }, { status: 401 });
    }

    const { user } = ctx;
    const body = await request.json().catch(() => ({}));
    const packId = String(body.packId ?? "").trim();
    const razorpay_order_id = String(body.razorpay_order_id ?? "").trim();
    const razorpay_payment_id = String(body.razorpay_payment_id ?? "").trim();
    const razorpay_signature = String(body.razorpay_signature ?? "").trim();

    const pack = teacherRdmPackById(packId);
    if (!pack) {
      return NextResponse.json({ error: "Invalid RDM pack selected" }, { status: 400 });
    }

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: "Missing verified Razorpay payment" }, { status: 400 });
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

    const expectedPaise = teacherRdmPackAmountPaise(packId);
    if (expectedPaise == null) {
      return NextResponse.json({ error: "Invalid RDM pack selected" }, { status: 400 });
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 500 });
    }

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Failed to verify user profile" }, { status: 500 });
    }

    if (profile.role !== "teacher") {
      return NextResponse.json({ error: "Only teachers can purchase RDM credits" }, { status: 403 });
    }

    const { data: existingCouponRaw } = await (admin as typeof admin & { from: (t: string) => any })
      .from("coupons")
      .select(
        "id, code, rdm_amount, status, balance_applied_at, redeemed_at, redeemed_by_teacher_id"
      )
      .eq("order_id", razorpay_order_id)
      .maybeSingle();

    const existingCoupon = existingCouponRaw as unknown as PurchasedCouponRow | null;

    if (existingCoupon) {
      const newBalance = await applyPurchasedCouponRdmCredit(admin, user.id, existingCoupon);
      return NextResponse.json({
        ok: true,
        code: existingCoupon.code,
        rdmAmount: existingCoupon.rdm_amount,
        newBalance,
        price: pack.priceInr,
        orderId: razorpay_order_id,
        alreadyProcessed: Boolean(existingCoupon.balance_applied_at),
        recovered: !existingCoupon.balance_applied_at,
      });
    }

    const newCouponCode = generateSubscriptionCouponCode();

    const { data: couponRaw, error: insertError } = await (admin as typeof admin & {
      from: (t: string) => any;
    })
      .from("coupons")
      .insert({
        code: newCouponCode,
        rdm_amount: pack.rdm,
        restricted_to_teacher_ids: [user.id],
        is_purchased: true,
        bought_by_teacher_id: user.id,
        status: "active",
        order_id: razorpay_order_id,
        payment_method: "razorpay",
      })
      .select(
        "id, code, rdm_amount, status, balance_applied_at, redeemed_at, redeemed_by_teacher_id"
      )
      .single();

    if (insertError || !couponRaw) {
      return NextResponse.json(
        { error: insertError?.message || "Failed to create coupon code" },
        { status: 500 },
      );
    }

    const coupon = couponRaw as unknown as PurchasedCouponRow;
    const newBalance = await applyPurchasedCouponRdmCredit(admin, user.id, coupon);

    return NextResponse.json({
      ok: true,
      code: coupon.code,
      rdmAmount: coupon.rdm_amount,
      newBalance,
      price: pack.priceInr,
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
    });
  } catch (e) {
    console.error("purchase coupon error", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 },
    );
  }
}
