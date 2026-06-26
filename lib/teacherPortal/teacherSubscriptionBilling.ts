import {
  computeTeacherCheckoutSummary,
  type PaidTeacherPlan,
} from "@/lib/subscription/teacherCheckoutSummary";
import { MS_PER_BILLING_DAY } from "@/lib/subscription/subscriptionBilling";
import {
  normalizeTeacherPlanTier,
  type TeacherPlanKey,
  type TeacherPlanProfileFields,
} from "@/lib/teacherPortal/teacherPlan";

export type TeacherSubscriptionPeriod = {
  planKey: PaidTeacherPlan;
  startedAt: string;
  expiresAt: string;
  startMs: number;
  endMs: number;
  totalDays: number;
  remainingDays: number;
  percentUsed: number;
  billingRateLabel: string;
  isCouponGrant: boolean;
  autoRenewActive: boolean;
};

export function parseTeacherPaymentDetails(
  raw: unknown
): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const obj =
      typeof raw === "string" ? (JSON.parse(raw) as Record<string, unknown>) : raw;
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      return obj as Record<string, unknown>;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function isTeacherPaidViaRazorpay(details: Record<string, unknown> | null): boolean {
  if (!details) return false;
  if (details.type === "teacher_razorpay") return true;
  return Boolean(details.teacher_razorpay_payment_id || details.teacher_razorpay_order_id);
}

export function resolveTeacherSubscriptionNowMs(
  profile?: TeacherPlanProfileFields | null,
  nowMs = Date.now()
): number {
  const offset = Math.max(0, Number(profile?.time_travel_offset_ms ?? 0));
  return nowMs + offset;
}

export function isTeacherAutoRenewActive(
  profile: TeacherPlanProfileFields & { payment_card_details?: unknown },
  effectiveTier: TeacherPlanKey
): boolean {
  if (effectiveTier !== "starter" && effectiveTier !== "pro") return false;
  const details = parseTeacherPaymentDetails(profile.payment_card_details);
  if (!isTeacherPaidViaRazorpay(details)) return false;
  return details?.teacher_auto_renew !== false;
}

export function computeTeacherSubscriptionPeriod(
  profile: TeacherPlanProfileFields & {
    payment_card_details?: unknown;
    teacher_plan_tier?: string | null;
  },
  nowMs = Date.now()
): TeacherSubscriptionPeriod | null {
  const tier = normalizeTeacherPlanTier(profile.teacher_plan_tier, profile);
  if (tier !== "starter" && tier !== "pro") return null;

  const effectiveNowMs = resolveTeacherSubscriptionNowMs(profile, nowMs);
  const startedAt =
    profile.teacher_plan_started_at ?? new Date(effectiveNowMs).toISOString();
  const startMs = Date.parse(startedAt);
  if (!Number.isFinite(startMs)) return null;

  const expiresAt = profile.teacher_plan_expires_at;
  const endMs = expiresAt ? Date.parse(expiresAt) : NaN;
  if (!Number.isFinite(endMs) || endMs <= startMs) return null;

  const totalDays = Math.max(1, Math.ceil((endMs - startMs) / MS_PER_BILLING_DAY));
  const remainingDays = Math.max(
    0,
    Math.ceil((endMs - effectiveNowMs) / MS_PER_BILLING_DAY)
  );
  const elapsedDays = Math.max(0, totalDays - remainingDays);
  const percentUsed =
    totalDays > 0 ? Math.min(100, Math.round((elapsedDays / totalDays) * 100)) : 0;

  const details = parseTeacherPaymentDetails(profile.payment_card_details);
  const isCouponGrant = !isTeacherPaidViaRazorpay(details);
  const summary = computeTeacherCheckoutSummary(tier);
  const billingRateLabel = isCouponGrant
    ? "Admin coupon grant"
    : `₹${summary.totalInr.toLocaleString("en-IN")} / month`;

  return {
    planKey: tier,
    startedAt,
    expiresAt: expiresAt!,
    startMs,
    endMs,
    totalDays,
    remainingDays,
    percentUsed,
    billingRateLabel,
    isCouponGrant,
    autoRenewActive: isTeacherAutoRenewActive(profile, tier),
  };
}
