import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { createAdminClient } from "@/integrations/supabase/server";
import {
  countTeacherAssignmentsThisMonth,
  countTeacherSlotsThisMonth,
  loadTeacherPlanContext,
} from "@/lib/teacherPortal/teacherPlanServer";
import {
  canBookMoreLiveClasses,
  canCreateMoreAssignments,
} from "@/lib/teacherPortal/teacherPlan";
import { computeTeacherSubscriptionPeriod } from "@/lib/teacherPortal/teacherSubscriptionBilling";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const ctx = await getSupabaseAndUser(request);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { user, supabase } = ctx;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "teacher") {
    return NextResponse.json({ error: "Teachers only" }, { status: 403 });
  }

  const planCtx = await loadTeacherPlanContext(user.id);
  if (!planCtx) {
    return NextResponse.json({ error: "Could not load plan" }, { status: 500 });
  }

  const admin = createAdminClient();
  let subscription = null;
  if (admin) {
    const { data: billingProfile } = await (admin as any)
      .from("profiles")
      .select(
        "teacher_plan_tier, teacher_plan_started_at, teacher_plan_expires_at, payment_card_details, time_travel_offset_ms"
      )
      .eq("id", user.id)
      .maybeSingle();
    if (billingProfile) {
      const period = computeTeacherSubscriptionPeriod(billingProfile);
      if (period) {
        subscription = {
          planKey: period.planKey,
          startedAt: period.startedAt,
          expiresAt: period.expiresAt,
          totalDays: period.totalDays,
          remainingDays: period.remainingDays,
          percentUsed: period.percentUsed,
          billingRateLabel: period.billingRateLabel,
          isCouponGrant: period.isCouponGrant,
          autoRenewActive: period.autoRenewActive,
        };
      }
    }
  }

  const [slotsBooked, assignmentsCreated] = await Promise.all([
    countTeacherSlotsThisMonth(user.id, new Date()),
    countTeacherAssignmentsThisMonth(user.id),
  ]);

  const liveQuota = canBookMoreLiveClasses(slotsBooked, planCtx.limits);
  const assignmentQuota = canCreateMoreAssignments(assignmentsCreated, planCtx.limits);

  return NextResponse.json({
    tier: planCtx.tier,
    limits: planCtx.limits,
    usage: {
      liveClassesBookedThisMonth: slotsBooked,
      assignmentsCreatedThisMonth: assignmentsCreated,
    },
    liveClasses: liveQuota,
    assignments: assignmentQuota,
    subscription,
  });
}
