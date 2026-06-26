import {
  addMonthsToDate,
  type SubscriptionCouponProfileFields,
} from "@/lib/subscription/subscriptionCouponUtils";
import type { TeacherPlanKey } from "@/lib/teacherPortal/teacherPlan";

export type TeacherPlanCouponProfileFields = {
  teacher_plan_tier?: string | null;
  teacher_plan_started_at?: string | null;
  teacher_plan_expires_at?: string | null;
  time_travel_offset_ms?: number | null;
};

function parsePaymentDetails(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const obj = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      return obj as Record<string, unknown>;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function getEffectiveTeacherPlanEndMs(
  profile: TeacherPlanCouponProfileFields,
  nowMs = Date.now() + (profile.time_travel_offset_ms ?? 0)
): number {
  const expiresAt = profile.teacher_plan_expires_at;
  if (expiresAt) {
    const ms = Date.parse(expiresAt);
    if (!Number.isNaN(ms) && ms > nowMs) return ms;
  }
  return nowMs;
}

export function computeExtendedTeacherPlanExpiry(
  profile: TeacherPlanCouponProfileFields,
  durationMonths: number,
  nowMs = Date.now() + (profile.time_travel_offset_ms ?? 0)
): string {
  const baseMs = getEffectiveTeacherPlanEndMs(profile, nowMs);
  const baseDate = new Date(Math.max(baseMs, nowMs));
  return addMonthsToDate(baseDate, durationMonths).toISOString();
}

export function describeTeacherCouponClaimResult(
  profile: TeacherPlanCouponProfileFields,
  planTier: TeacherPlanKey,
  durationMonths: number,
  newExpiresAt: string,
  nowMs = Date.now() + (profile.time_travel_offset_ms ?? 0)
): { mode: "new" | "extend"; message: string; detail: string } {
  const planLabel = planTier === "pro" ? "Pro Teacher" : "Starter Teacher";
  const endLabel = new Date(newExpiresAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const hadRemaining = getEffectiveTeacherPlanEndMs(profile, nowMs) > nowMs;
  const monthWord = durationMonths === 1 ? "month" : "months";

  if (hadRemaining) {
    return {
      mode: "extend",
      message: `Added ${durationMonths} ${monthWord} to your ${planLabel} plan.`,
      detail: `Your plan stays active until ${endLabel}.`,
    };
  }
  return {
    mode: "new",
    message: `Upgraded to ${planLabel} — starts today.`,
    detail: `You have ${durationMonths} ${monthWord} of access, until ${endLabel}.`,
  };
}

/** Re-export for symmetry with student coupons — payment_card_details not used for teachers. */
export type { SubscriptionCouponProfileFields };
