import type { SubscriptionPlanKey } from "@/lib/subscription/subscriptionConfig";

function isUnlimited(limit: number): boolean {
  return limit < 0;
}

export type MagicWallPeriodBounds = {
  periodStart: Date;
  periodEnd: Date;
};

export type MagicWallUsage = {
  plan: SubscriptionPlanKey;
  maxActive: number;
  monthlyLimit: number;
  monthlyUsed: number;
  monthlyRemaining: number | null;
  activeCount: number;
  activeSlotsRemaining: number | null;
  newPicksAllowed: number | null;
  periodStart: string;
  periodEnd: string;
};

/** UTC date at year/month with day clamped to month length (signup anniversary). */
export function utcDateAtYearMonth(year: number, month: number, preferredDay: number): Date {
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(Math.max(1, preferredDay), daysInMonth);
  return new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
}

/**
 * Rolling monthly billing window anchored to account signup (profiles.created_at).
 * Example: signup May 15 → periods May 15–Jun 14, Jun 15–Jul 14, …
 */
export function getRollingMonthlyPeriodBounds(
  anchorIso: string,
  now: Date = new Date()
): MagicWallPeriodBounds {
  const anchor = new Date(anchorIso);
  if (Number.isNaN(anchor.getTime())) {
    const fallbackStart = utcDateAtYearMonth(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate()
    );
    const endY = fallbackStart.getUTCFullYear();
    let endM = fallbackStart.getUTCMonth() + 1;
    if (endM > 11) {
      endM = 0;
    }
    const periodEnd = utcDateAtYearMonth(
      endM === 0 ? endY + 1 : endY,
      endM,
      fallbackStart.getUTCDate()
    );
    return { periodStart: fallbackStart, periodEnd };
  }

  const anchorDay = anchor.getUTCDate();

  let y = now.getUTCFullYear();
  let m = now.getUTCMonth();
  let periodStart = utcDateAtYearMonth(y, m, anchorDay);

  if (periodStart.getTime() > now.getTime()) {
    m -= 1;
    if (m < 0) {
      m = 11;
      y -= 1;
    }
    periodStart = utcDateAtYearMonth(y, m, anchorDay);
  }

  let endY = periodStart.getUTCFullYear();
  let endM = periodStart.getUTCMonth() + 1;
  if (endM > 11) {
    endM = 0;
    endY += 1;
  }
  const periodEnd = utcDateAtYearMonth(endY, endM, anchorDay);

  return { periodStart, periodEnd };
}

export function computeMagicWallUsage(input: {
  plan: SubscriptionPlanKey;
  activeCount: number;
  monthlyUsed: number;
  maxActive: number;
  monthlyLimit: number;
  periodStart: Date;
  periodEnd: Date;
}): MagicWallUsage {
  const { plan, activeCount, monthlyUsed, maxActive, monthlyLimit, periodStart, periodEnd } =
    input;

  const unlimitedActive = isUnlimited(maxActive);
  const unlimitedMonthly = isUnlimited(monthlyLimit);

  const activeSlotsRemaining = unlimitedActive
    ? null
    : Math.max(0, maxActive - Math.max(0, activeCount));

  const monthlyRemaining = unlimitedMonthly
    ? null
    : Math.max(0, monthlyLimit - Math.max(0, monthlyUsed));

  let newPicksAllowed: number | null;
  if (unlimitedActive && unlimitedMonthly) {
    newPicksAllowed = null;
  } else if (unlimitedActive) {
    newPicksAllowed = monthlyRemaining;
  } else if (unlimitedMonthly) {
    newPicksAllowed = activeSlotsRemaining;
  } else {
    newPicksAllowed = Math.min(monthlyRemaining!, activeSlotsRemaining!);
  }

  return {
    plan,
    maxActive,
    monthlyLimit,
    monthlyUsed,
    monthlyRemaining,
    activeCount,
    activeSlotsRemaining,
    newPicksAllowed,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
  };
}

export function buildMagicWallAddLimitError(usage: MagicWallUsage, requestedAdd: number): string {
  const allowed = usage.newPicksAllowed ?? requestedAdd;
  if (requestedAdd <= allowed) return "";

  const parts: string[] = [];
  if (usage.newPicksAllowed === 0) {
    parts.push("You cannot add more topics right now.");
  } else {
    parts.push(
      `You can add ${usage.newPicksAllowed} more topic${usage.newPicksAllowed === 1 ? "" : "s"} this period.`
    );
  }

  if (!isUnlimited(usage.maxActive)) {
    parts.push(
      `${usage.activeCount}/${usage.maxActive} active slot${usage.maxActive === 1 ? "" : "s"} in use.`
    );
  }
  if (!isUnlimited(usage.monthlyLimit)) {
    parts.push(
      `${usage.monthlyUsed}/${usage.monthlyLimit} new pick${usage.monthlyLimit === 1 ? "" : "s"} used this period.`
    );
  }
  parts.push("Complete a topic to free a slot, or wait until your next billing period.");

  return parts.join(" ");
}

export function formatMagicWallPeriodEndLocal(periodEndIso: string): string {
  const d = new Date(periodEndIso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
