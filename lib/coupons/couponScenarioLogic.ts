/** Student plan coupon claim validation (used by claim-plan API). */

export type StudentPlanCouponRow = {
  code?: string;
  status: string;
  plan_tier: string;
  duration_months: number;
  restricted_to_user_ids?: string[] | null;
};

export function studentClaimError(
  coupon: StudentPlanCouponRow | null | undefined,
  studentId: string,
  role: string
): string | null {
  if (role !== "student") return "Only students can claim plan coupons";
  if (!coupon) return "Invalid coupon code";
  if (coupon.status !== "active") {
    return "This coupon is already redeemed or expired";
  }
  if (coupon.restricted_to_user_ids && coupon.restricted_to_user_ids.length > 0) {
    if (!coupon.restricted_to_user_ids.includes(studentId)) {
      return "This coupon is not valid for your account";
    }
  }
  if (coupon.plan_tier !== "starter" && coupon.plan_tier !== "pro") {
    return "Invalid coupon plan configuration";
  }
  if (!coupon.duration_months || coupon.duration_months <= 0) {
    return "Invalid coupon duration";
  }
  return null;
}
