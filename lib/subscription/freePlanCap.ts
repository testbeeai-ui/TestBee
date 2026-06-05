import {
  SUBSCRIPTION_CONFIG_DEFAULTS,
  type SubscriptionConfig,
  type SubscriptionPlanKey,
} from "@/lib/subscription/subscriptionConfig";
import { resolveFreeTrialStartMs } from "@/lib/subscription/freeTrialTimer";

/**
 * Investor rule: a user on the Free plan gets 3 mock tests per month, capped at
 * 2 calendar months total (~6 mocks/year). After the cap is hit the mock quota
 * is soft-blocked until they upgrade to Starter or Pro.
 *
 * The "Free plan start" anchor is read from
 * `profiles.trial_original_ended_at` (set by the trial-exit flow). When that
 * column is missing we fall back to the trial activation timestamp + the
 * resolved trial duration so the cap still applies for users who never went
 * through the explicit trial-exit endpoint.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const APPROX_MS_PER_MONTH = 30 * MS_PER_DAY;

export type FreePlanCapProfile = {
  plan_tier?: string | null;
  free_trial_activated?: boolean | null;
  free_trial_activated_at?: string | null;
  trial_second_round_activated?: boolean | null;
  trial_original_ended_at?: string | null;
  created_at?: string | null;
  time_travel_offset_ms?: number | null;
};

export function getFreePlanMaxMonths(cfg?: SubscriptionConfig | null): number {
  const v = cfg?.["free_plan_max_months"];
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  return SUBSCRIPTION_CONFIG_DEFAULTS.free_plan_max_months as number;
}

/**
 * Best-effort "when did this user enter the Free plan" timestamp.
 * Returns null if the user has never been in a free trial (e.g. they signed up
 * straight onto a paid plan, in which case the cap is not applicable).
 */
export function getFreePlanStartedAtMs(
  profile: FreePlanCapProfile | null | undefined,
  cfg?: SubscriptionConfig | null
): number | null {
  if (!profile) return null;

  const explicit = parseIso(profile.trial_original_ended_at);
  if (explicit != null) return explicit;

  // Fallback: derive the trial-end instant from the activation timestamp
  // + resolved duration (so users who never ran the trial-exit endpoint
  // still see the cap kick in correctly under time-travel).
  const trialStart = resolveFreeTrialStartMs({
    freeTrialActivatedAt: profile.free_trial_activated_at,
    freeTrialActivated: profile.free_trial_activated,
    createdAt: profile.created_at,
  });
  if (trialStart == null) return null;

  const base = Math.max(
    1,
    Math.round(
      (cfg?.["free_trial_duration_days"] ??
        SUBSCRIPTION_CONFIG_DEFAULTS.free_trial_duration_days) as number
    )
  );
  const extension = Math.max(
    0,
    Math.round(
      (cfg?.["free_trial_streak_extension_days"] ??
        SUBSCRIPTION_CONFIG_DEFAULTS.free_trial_streak_extension_days) as number
    )
  );
  const secondRound = Boolean(profile.trial_second_round_activated);
  const totalDays = secondRound ? base + extension : base;
  return trialStart + totalDays * MS_PER_DAY;
}

/** Number of complete calendar months the user has been on the Free plan. */
export function getFreePlanMonthsElapsed(
  profile: FreePlanCapProfile | null | undefined,
  cfg?: SubscriptionConfig | null,
  nowMs: number = Date.now()
): number {
  const start = getFreePlanStartedAtMs(profile, cfg);
  if (start == null) return 0;
  if (nowMs < start) return 0;
  const months = (nowMs - start) / APPROX_MS_PER_MONTH;
  return Math.max(0, Math.floor(months));
}

/**
 * True when the user is on the Free plan AND has exceeded the calendar-month
 * cap. After this point, mock tests should be soft-blocked (other Free
 * features — Gyan++ doubts, lessons, daily dose — keep working).
 */
export function isFreePlanCapExceeded(
  profile: FreePlanCapProfile | null | undefined,
  cfg?: SubscriptionConfig | null,
  nowMs: number = Date.now()
): boolean {
  if (!profile) return false;
  const tier = String(profile.plan_tier ?? "")
    .trim()
    .toLowerCase();
  if (tier !== "free") return false;
  const maxMonths = getFreePlanMaxMonths(cfg);
  return getFreePlanMonthsElapsed(profile, cfg, nowMs) >= maxMonths;
}

export function getNowMsForProfile(
  profile: FreePlanCapProfile | null | undefined,
  nowMs: number = Date.now()
): number {
  const offset = Number(profile?.time_travel_offset_ms ?? 0);
  if (!Number.isFinite(offset) || offset < 0) return nowMs;
  return nowMs + offset;
}

/**
 * Convenience: should the mock quota be soft-blocked right now for this
 * profile? Combines plan-tier normalisation with the cap check and applies
 * dev time-travel.
 */
export function shouldBlockMocksForFreePlanCap(
  profile: FreePlanCapProfile | null | undefined,
  currentPlan: SubscriptionPlanKey,
  cfg?: SubscriptionConfig | null,
  nowMs: number = Date.now()
): boolean {
  if (currentPlan !== "free") return false;
  return isFreePlanCapExceeded(profile, cfg, getNowMsForProfile(profile, nowMs));
}

function parseIso(value: string | null | undefined): number | null {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : null;
}
