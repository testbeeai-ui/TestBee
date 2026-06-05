import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { enforceSameOriginForCookieAuth } from "@/lib/auth/securityGuards";
import { createAdminClient } from "@/integrations/supabase/server";
import { studentClaimError } from "@/lib/coupons/couponScenarioLogic";
import {
  computeExtendedSubscriptionExpiry,
  describeCouponClaimResult,
} from "@/lib/subscription/subscriptionCouponUtils";

export async function GET(request: Request) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { user, supabase } = ctx;

    const { data: profileRow, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profileRow) {
      return NextResponse.json({ error: "Failed to verify user profile" }, { status: 500 });
    }

    if (profileRow.role !== "student") {
      return NextResponse.json({ error: "Only students can view plan coupons" }, { status: 403 });
    }

    const { data: coupons, error: couponsError } = await (supabase as any)
      .from("subscription_coupons")
      .select("id, code, plan_tier, duration_months, created_at")
      .eq("status", "active")
      .contains("restricted_to_user_ids", [user.id])
      .order("created_at", { ascending: false });

    if (couponsError) {
      return NextResponse.json({ error: couponsError.message }, { status: 500 });
    }

    return NextResponse.json({ coupons: coupons ?? [] });
  } catch (e) {
    console.error("claim-plan coupons GET error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const csrf = enforceSameOriginForCookieAuth(request);
    if (csrf) return csrf;

    const ctx = await getSupabaseAndUser(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { user } = ctx;
    const body = await request.json().catch(() => ({}));
    const code = String(body.code ?? "").trim().toUpperCase();

    if (!code) {
      return NextResponse.json({ error: "Coupon code is required" }, { status: 400 });
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 500 });
    }

    const { data: profileRow, error: profileError } = await admin
      .from("profiles")
      .select(
        "role, plan_tier, subscription_started_at, subscription_expires_at, payment_card_details, time_travel_offset_ms, free_trial_activated"
      )
      .eq("id", user.id)
      .single();

    if (profileError || !profileRow) {
      return NextResponse.json({ error: "Failed to verify user profile" }, { status: 500 });
    }

    if (profileRow.role !== "student") {
      return NextResponse.json({ error: "Only students can claim plan coupons" }, { status: 403 });
    }

    const { data: couponData, error: couponError } = await (admin as any)
      .from("subscription_coupons")
      .select("*")
      .eq("code", code)
      .maybeSingle();

    if (couponError) {
      return NextResponse.json({ error: couponError.message }, { status: 500 });
    }

    if (!couponData) {
      return NextResponse.json({ error: "Invalid coupon code" }, { status: 400 });
    }

    const coupon = couponData as {
      id: string;
      code: string;
      plan_tier: string;
      duration_months: number;
      restricted_to_user_ids: string[] | null;
      status: string;
    };

    const claimValidationError = studentClaimError(coupon, user.id, profileRow.role);
    if (claimValidationError) {
      const status =
        claimValidationError === "This coupon is not valid for your account" ? 403 : 400;
      return NextResponse.json({ error: claimValidationError }, { status });
    }

    const nowIso = new Date().toISOString();
    const nowMs =
      Date.now() + (Number(profileRow.time_travel_offset_ms) || 0);

    const newExpiresAt = computeExtendedSubscriptionExpiry(
      {
        subscription_expires_at: profileRow.subscription_expires_at,
        subscription_started_at: profileRow.subscription_started_at,
        payment_card_details: profileRow.payment_card_details,
        plan_tier: profileRow.plan_tier,
        time_travel_offset_ms: profileRow.time_travel_offset_ms,
      },
      coupon.duration_months,
      nowMs
    );

    const { data: redeemedRows, error: redeemError } = await (admin as any)
      .from("subscription_coupons")
      .update({
        status: "redeemed",
        redeemed_at: nowIso,
        redeemed_by_user_id: user.id,
      })
      .eq("id", coupon.id)
      .eq("status", "active")
      .select("id");

    if (redeemError) {
      return NextResponse.json({ error: "Failed to redeem coupon" }, { status: 500 });
    }

    if (!redeemedRows?.length) {
      return NextResponse.json(
        { error: "This coupon is already redeemed or expired" },
        { status: 400 }
      );
    }

    const paymentMarker = {
      type: "coupon",
      planSelected: coupon.plan_tier,
      couponCode: coupon.code,
      durationMonths: coupon.duration_months,
      autoRenew: false,
    };

    const startedAt =
      profileRow.subscription_started_at &&
      (profileRow.plan_tier === "starter" ||
        profileRow.plan_tier === "pro" ||
        profileRow.plan_tier === "scholar" ||
        profileRow.plan_tier === "champion" ||
        profileRow.plan_tier === "pro_plus")
        ? profileRow.subscription_started_at
        : nowIso;

    const { error: updateError } = await admin
      .from("profiles")
      .update({
        plan_tier: coupon.plan_tier,
        free_trial_activated: false,
        subscription_started_at: startedAt,
        subscription_expires_at: newExpiresAt,
        payment_card_details: paymentMarker,
      })
      .eq("id", user.id);

    if (updateError) {
      await (admin as any)
        .from("subscription_coupons")
        .update({
          status: "active",
          redeemed_at: null,
          redeemed_by_user_id: null,
        })
        .eq("id", coupon.id);

      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    const claimCopy = describeCouponClaimResult(
      {
        subscription_expires_at: profileRow.subscription_expires_at,
        subscription_started_at: profileRow.subscription_started_at,
        payment_card_details: profileRow.payment_card_details,
        plan_tier: profileRow.plan_tier,
        time_travel_offset_ms: profileRow.time_travel_offset_ms,
      },
      coupon.plan_tier,
      coupon.duration_months,
      newExpiresAt,
      nowMs
    );

    return NextResponse.json({
      ok: true,
      planTier: coupon.plan_tier,
      durationMonths: coupon.duration_months,
      expiresAt: newExpiresAt,
      activationMode: claimCopy.mode,
      message: claimCopy.message,
      detail: claimCopy.detail,
    });
  } catch (e) {
    console.error("claim-plan coupon error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
