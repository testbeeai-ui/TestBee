import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { createAdminClient } from "@/integrations/supabase/server";
import { enforceSameOriginForCookieAuth } from "@/lib/auth/securityGuards";
import {
  computeTeacherSubscriptionPeriod,
  isTeacherPaidViaRazorpay,
  parseTeacherPaymentDetails,
} from "@/lib/teacherPortal/teacherSubscriptionBilling";
import { normalizeTeacherPlanTier } from "@/lib/teacherPortal/teacherPlan";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const csrf = enforceSameOriginForCookieAuth(request);
    if (csrf) return csrf;

    const ctx = await getSupabaseAndUser(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { user } = ctx;
    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }

    const { data: profile } = await (admin as any)
      .from("profiles")
      .select(
        "role, teacher_plan_tier, teacher_plan_started_at, teacher_plan_expires_at, payment_card_details, time_travel_offset_ms"
      )
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role !== "teacher") {
      return NextResponse.json({ error: "Teachers only" }, { status: 403 });
    }

    const tier = normalizeTeacherPlanTier(profile.teacher_plan_tier, profile);
    if (tier === "free") {
      return NextResponse.json({ error: "No active paid plan" }, { status: 400 });
    }

    const details = parseTeacherPaymentDetails(profile.payment_card_details);
    if (!isTeacherPaidViaRazorpay(details)) {
      return NextResponse.json(
        { error: "Coupon plans cannot enable auto-renewal" },
        { status: 400 }
      );
    }

    const period = computeTeacherSubscriptionPeriod(profile);
    if (!period) {
      return NextResponse.json({ error: "Subscription period not found" }, { status: 400 });
    }

    const { error: updateError } = await (admin as any)
      .from("profiles")
      .update({
        payment_card_details: {
          ...(details ?? {}),
          teacher_auto_renew: true,
          teacher_auto_renew_resumed_at: new Date().toISOString(),
        },
      })
      .eq("id", user.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      autoRenewActive: true,
      expiresAt: period.expiresAt,
    });
  } catch (e) {
    console.error("teacher resume-renewal error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
