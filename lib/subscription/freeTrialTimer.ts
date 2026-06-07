import { SUBSCRIPTION_CONFIG_DEFAULTS, type SubscriptionConfig } from "@/lib/subscription/subscriptionConfig";

/** Wall-clock free trial length from activation (matches product copy). */
export const FREE_TRIAL_DURATION_DAYS = 14;

export const FREE_TRIAL_DURATION_MS = FREE_TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000;

export const FREE_TRIAL_SECOND_ROUND_DAYS = 28;

export const FREE_TRIAL_SECOND_ROUND_MS = FREE_TRIAL_SECOND_ROUND_DAYS * 24 * 60 * 60 * 1000;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Resolve the effective trial duration in days for a profile, honouring the
 * admin-configurable base length, streak extension, and the second-round flag.
 */
export function resolveTrialDurationDaysForProfile(
  profile: FreeTrialClockProfile | null | undefined,
  cfg?: SubscriptionConfig | null
): number {
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
  const secondRound = Boolean(profile?.trial_second_round_activated);
  return secondRound ? base + extension : base;
}

export function resolveTrialDurationMsForProfile(
  profile: FreeTrialClockProfile | null | undefined,
  cfg?: SubscriptionConfig | null
): number {
  return resolveTrialDurationDaysForProfile(profile, cfg) * MS_PER_DAY;
}

export function getFreeTrialElapsedMs(
  activatedAtIso: string | null | undefined,
  now = Date.now(),
  secondRound = false
): number {
  if (!activatedAtIso) return 0;
  const start = Date.parse(activatedAtIso);
  if (!Number.isFinite(start)) return 0;
  const durationDays = secondRound ? FREE_TRIAL_SECOND_ROUND_DAYS : FREE_TRIAL_DURATION_DAYS;
  const durationMs = durationDays * 24 * 60 * 60 * 1000;
  const elapsed = now - start;
  if (elapsed < 0) return 0;
  return Math.min(elapsed, durationMs);
}

export function isFreeTrialPeriodEnded(
  activatedAtIso: string | null | undefined,
  now = Date.now(),
  secondRound = false
): boolean {
  const start = parseTrialStartMs(activatedAtIso);
  if (start == null) return false;
  const durationDays = secondRound ? FREE_TRIAL_SECOND_ROUND_DAYS : FREE_TRIAL_DURATION_DAYS;
  const durationMs = durationDays * 24 * 60 * 60 * 1000;
  return now - start >= durationMs;
}

function parseTrialStartMs(activatedAtIso: string | null | undefined): number | null {
  if (!activatedAtIso) return null;
  const start = Date.parse(activatedAtIso);
  return Number.isFinite(start) ? start : null;
}

/** Trial clock anchor: activation timestamp, else profile created_at when trial flag is set. */
export function resolveFreeTrialStartMs(input: {
  freeTrialActivatedAt?: string | null;
  freeTrialActivated?: boolean | null;
  createdAt?: string | null;
}): number | null {
  const fromActivation = parseTrialStartMs(input.freeTrialActivatedAt ?? null);
  if (fromActivation != null) return fromActivation;
  if (input.freeTrialActivated && input.createdAt) {
    const fromCreated = Date.parse(input.createdAt);
    if (Number.isFinite(fromCreated)) return fromCreated;
  }
  return null;
}

export type FreeTrialClockProfile = {
  free_trial_activated_at?: string | null;
  free_trial_activated?: boolean | null;
  created_at?: string | null;
  trial_second_round_activated?: boolean | null;
  trial_end_bonus_activated?: boolean | null;
};

export function isFreeTrialPeriodEndedForProfile(
  profile: FreeTrialClockProfile | null | undefined,
  nowMs: number,
  cfg?: SubscriptionConfig | null
): boolean {
  const start = resolveFreeTrialStartMs({
    freeTrialActivatedAt: profile?.free_trial_activated_at,
    freeTrialActivated: profile?.free_trial_activated,
    createdAt: profile?.created_at,
  });
  if (start == null) return false;
  return nowMs - start >= resolveTrialDurationMsForProfile(profile, cfg);
}

/**
 * True if the student is currently inside an active free trial window
 * (i.e. trial flag set AND trial clock has not yet expired).
 */
export function isFreeTrialActiveForProfile(
  profile: FreeTrialClockProfile | null | undefined,
  nowMs: number,
  cfg?: SubscriptionConfig | null
): boolean {
  if (!profile) return false;
  const activated = Boolean(
    profile.free_trial_activated || profile.trial_second_round_activated
  );
  if (!activated) return false;
  if (profile.trial_end_bonus_activated) return false;
  return !isFreeTrialPeriodEndedForProfile(profile, nowMs, cfg);
}

/** Dev preset: jump to 1 minute after this profile's trial window ends (uses real trial anchor). */
export function computeOffsetForTrialEndFromProfile(
  profile: FreeTrialClockProfile | null | undefined,
  cfg?: SubscriptionConfig | null
): number {
  const start = resolveFreeTrialStartMs({
    freeTrialActivatedAt: profile?.free_trial_activated_at,
    freeTrialActivated: profile?.free_trial_activated,
    createdAt: profile?.created_at,
  });
  if (start == null) return 0;
  const target = start + resolveTrialDurationMsForProfile(profile, cfg) + 60_000;
  return Math.max(0, target - Date.now());
}

/** Formats elapsedMs as a remaining trial countdown — `13d 23:59:59` or `23:59:59`. */
export function formatFreeTrialElapsedTimer(elapsedMs: number, secondRound = false): string {
  const durationDays = secondRound ? FREE_TRIAL_SECOND_ROUND_DAYS : FREE_TRIAL_DURATION_DAYS;
  const durationMs = durationDays * 24 * 60 * 60 * 1000;
  const remainingMs = Math.max(0, durationMs - elapsedMs);
  const totalSeconds = Math.floor(remainingMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const h = Math.floor((totalSeconds % 86400) / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  if (days > 0) return `${days}d ${time}`;
  return time;
}
