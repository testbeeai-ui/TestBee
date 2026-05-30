/** Wall-clock free trial length from activation (matches product copy). */
export const FREE_TRIAL_DURATION_DAYS = 14;

export const FREE_TRIAL_DURATION_MS = FREE_TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000;

export function getFreeTrialElapsedMs(
  activatedAtIso: string | null | undefined,
  now = Date.now()
): number {
  if (!activatedAtIso) return 0;
  const start = Date.parse(activatedAtIso);
  if (!Number.isFinite(start)) return 0;
  const elapsed = now - start;
  if (elapsed < 0) return 0;
  return Math.min(elapsed, FREE_TRIAL_DURATION_MS);
}

export function isFreeTrialPeriodEnded(
  activatedAtIso: string | null | undefined,
  now = Date.now()
): boolean {
  if (!activatedAtIso) return false;
  const start = Date.parse(activatedAtIso);
  if (!Number.isFinite(start)) return false;
  return now - start >= FREE_TRIAL_DURATION_MS;
}

/** Formats elapsedMs as a remaining trial countdown — `13d 23:59:59` or `23:59:59`. */
export function formatFreeTrialElapsedTimer(elapsedMs: number): string {
  const remainingMs = Math.max(0, FREE_TRIAL_DURATION_MS - elapsedMs);
  const totalSeconds = Math.floor(remainingMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const h = Math.floor((totalSeconds % 86400) / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  if (days > 0) return `${days}d ${time}`;
  return time;
}
