/** Shared helpers for student plan coupon generation and redemption. */

export function generateSubscriptionCouponCode(): string {
  const yearSuffix = new Date().getFullYear().toString().slice(-2);
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "123456789";

  const startWithLetter = Math.random() < 0.5;
  let randomPart = "";
  for (let i = 0; i < 6; i++) {
    const pickLetter = startWithLetter ? i % 2 === 0 : i % 2 !== 0;
    if (pickLetter) {
      randomPart += letters.charAt(Math.floor(Math.random() * letters.length));
    } else {
      randomPart += digits.charAt(Math.floor(Math.random() * digits.length));
    }
  }
  return `${yearSuffix}${randomPart}`;
}

/** Add calendar months to a date (preserves day-of-month where possible). */
export function addMonthsToDate(base: Date, months: number): Date {
  const result = new Date(base);
  const day = result.getDate();
  result.setMonth(result.getMonth() + months);
  if (result.getDate() < day) {
    result.setDate(0);
  }
  return result;
}

export type SubscriptionCouponProfileFields = {
  subscription_expires_at?: string | null;
  subscription_started_at?: string | null;
  payment_card_details?: unknown;
  plan_tier?: string | null;
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

/** Effective paid-plan end from profile (for extend-on-claim). */
export function getEffectiveSubscriptionEndMs(
  profile: SubscriptionCouponProfileFields,
  nowMs = Date.now() + (profile.time_travel_offset_ms ?? 0)
): number {
  const expiresAt = profile.subscription_expires_at;
  const paymentDetails = parsePaymentDetails(profile.payment_card_details);
  const isCouponGrant = paymentDetails?.type === "coupon";

  if (expiresAt) {
    const ms = Date.parse(expiresAt);
    if (!Number.isNaN(ms)) {
      if (ms > nowMs) return ms;
      // Expired coupon grant: do not fall back to a 30-day Razorpay window.
      if (isCouponGrant) return nowMs;
    }
  }

  const normalized = String(profile.plan_tier ?? "").trim().toLowerCase();
  const isPaid =
    normalized === "starter" ||
    normalized === "scholar" ||
    normalized === "pro" ||
    normalized === "champion" ||
    normalized === "pro_plus";

  if (isPaid && profile.subscription_started_at) {
    try {
      const startMs = Date.parse(profile.subscription_started_at);
      if (!Number.isNaN(startMs)) {
        const isAnnual = paymentDetails?.billingCycle === "annual";
        const totalDays = isAnnual ? 365 : 30;
        const endMs = startMs + totalDays * 24 * 60 * 60 * 1000;
        if (endMs > nowMs) return endMs;
      }
    } catch {
      /* ignore */
    }
  }

  return nowMs;
}

export function computeExtendedSubscriptionExpiry(
  profile: SubscriptionCouponProfileFields,
  durationMonths: number,
  nowMs = Date.now() + (profile.time_travel_offset_ms ?? 0)
): string {
  const baseMs = getEffectiveSubscriptionEndMs(profile, nowMs);
  const baseDate = new Date(Math.max(baseMs, nowMs));
  return addMonthsToDate(baseDate, durationMonths).toISOString();
}

const COUPON_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "long",
  day: "numeric",
};

export function formatCouponExpiryDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, COUPON_DATE_FORMAT);
}

/** Plain-language copy for coupon claim success (new upgrade vs extending existing time). */
export function describeCouponClaimResult(
  profile: SubscriptionCouponProfileFields,
  planTier: string,
  durationMonths: number,
  newExpiresAt: string,
  nowMs = Date.now() + (profile.time_travel_offset_ms ?? 0)
): { mode: "new" | "extend"; message: string; detail: string } {
  const planLabel = planTier === "pro" ? "Pro Plan" : "Starter Plan";
  const endLabel = formatCouponExpiryDate(newExpiresAt);
  const hadRemainingPaidTime = getEffectiveSubscriptionEndMs(profile, nowMs) > nowMs;

  if (hadRemainingPaidTime) {
    const monthWord = durationMonths === 1 ? "month" : "months";
    return {
      mode: "extend",
      message: `Added ${durationMonths} ${monthWord} to your ${planLabel}.`,
      detail: `Your plan stays active until ${endLabel}.`,
    };
  }

  const monthWord = durationMonths === 1 ? "month" : "months";
  return {
    mode: "new",
    message: `Upgraded to ${planLabel} — starts today.`,
    detail: `You have ${durationMonths} ${monthWord} of access, until ${endLabel}.`,
  };
}
