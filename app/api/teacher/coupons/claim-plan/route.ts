import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { enforceSameOriginForCookieAuth } from "@/lib/auth/securityGuards";
import { createAdminClient } from "@/integrations/supabase/server";
import { generateSubscriptionCouponCode } from "@/lib/subscription/subscriptionCouponUtils";
import {
  computeExtendedTeacherPlanExpiry,
  describeTeacherCouponClaimResult,
} from "@/lib/teacherPortal/teacherPlanCouponUtils";
import type { TeacherPlanKey } from "@/lib/teacherPortal/teacherPlan";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { user, supabase } = ctx;
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileRow?.role !== "teacher") {
      return NextResponse.json({ error: "Teachers only" }, { status: 403 });
    }

    const { data: coupons, error } = await (supabase as any)
      .from("teacher_subscription_coupons")
      .select("id, code, plan_tier, duration_months, created_at")
      .eq("status", "active")
      .contains("restricted_to_teacher_ids", [user.id])
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ coupons: coupons ?? [] });
  } catch (e) {
    console.error("teacher claim-plan GET error", e);
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

    const { data: profileRow, error: profileError } = await (admin as any)
      .from("profiles")
      .select(
        "role, teacher_plan_tier, teacher_plan_started_at, teacher_plan_expires_at, time_travel_offset_ms"
      )
      .eq("id", user.id)
      .single();

    if (profileError || !profileRow) {
      return NextResponse.json({ error: "Failed to verify profile" }, { status: 500 });
    }
    if (profileRow.role !== "teacher") {
      return NextResponse.json({ error: "Teachers only" }, { status: 403 });
    }

    const { data: coupon, error: couponError } = await (admin as any)
      .from("teacher_subscription_coupons")
      .select("*")
      .eq("code", code)
      .maybeSingle();

    if (couponError) {
      return NextResponse.json({ error: couponError.message }, { status: 500 });
    }
    if (!coupon) {
      return NextResponse.json({ error: "Invalid coupon code" }, { status: 400 });
    }
    if (coupon.status !== "active") {
      return NextResponse.json({ error: "This coupon has already been used" }, { status: 400 });
    }

    const restricted: string[] | null = coupon.restricted_to_teacher_ids;
    if (restricted?.length && !restricted.includes(user.id)) {
      return NextResponse.json({ error: "This coupon is not assigned to your account" }, { status: 403 });
    }

    const planTier = String(coupon.plan_tier).toLowerCase() as TeacherPlanKey;
    if (planTier !== "starter" && planTier !== "pro") {
      return NextResponse.json({ error: "Invalid coupon plan" }, { status: 400 });
    }

    const durationMonths = Number(coupon.duration_months) || 1;
    const nowIso = new Date().toISOString();
    const newExpiresAt = computeExtendedTeacherPlanExpiry(profileRow, durationMonths);

    const { error: redeemErr } = await (admin as any)
      .from("teacher_subscription_coupons")
      .update({
        status: "redeemed",
        redeemed_at: nowIso,
        redeemed_by_teacher_id: user.id,
      })
      .eq("id", coupon.id)
      .eq("status", "active");

    if (redeemErr) {
      return NextResponse.json({ error: redeemErr.message }, { status: 500 });
    }

    const { error: updateErr } = await (admin as any)
      .from("profiles")
      .update({
        teacher_plan_tier: planTier,
        teacher_plan_started_at: profileRow.teacher_plan_started_at ?? nowIso,
        teacher_plan_expires_at: newExpiresAt,
      })
      .eq("id", user.id);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    const copy = describeTeacherCouponClaimResult(
      profileRow,
      planTier,
      durationMonths,
      newExpiresAt
    );

    return NextResponse.json({
      ok: true,
      plan: planTier,
      expiresAt: newExpiresAt,
      message: copy.message,
      detail: copy.detail,
    });
  } catch (e) {
    console.error("teacher claim-plan POST error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
