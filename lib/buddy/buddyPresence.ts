import type { BuddyDashboardResponse } from "@/lib/buddy/buddyClient";

/**
 * Max age of last heartbeat to show “Online now” / live dot.
 * Site presence pings every ~30s; lesson presence every ~90s — keep window above both.
 */
export const BUDDY_LIVE_WINDOW_MS = 5 * 60 * 1000;

/** How long subtopic / “studying” activity stays “recent” in the right-now card. */
export const BUDDY_ACTIVITY_RECENT_MS = 15 * 60 * 1000;

const LIVE_KINDS = new Set<BuddyDashboardResponse["rightNow"]["kind"]>([
  "studying",
  "gyan_active",
  "community_posted",
  "gyan_browsing",
  "quiz_attempted",
  "online",
]);

export function buddyActivityAgeMs(lastActiveAt: string | null | undefined): number | null {
  if (!lastActiveAt) return null;
  const ms = Date.now() - Date.parse(lastActiveAt);
  return Number.isFinite(ms) ? ms : null;
}

/** Allow small client/server clock skew so heartbeats are not rejected as "future". */
const LIVE_CLOCK_SKEW_MS = 60 * 1000;

export function isWithinBuddyLiveWindow(lastActiveAt: string | null | undefined): boolean {
  const age = buddyActivityAgeMs(lastActiveAt);
  if (age == null || !Number.isFinite(age)) return false;
  return age <= BUDDY_LIVE_WINDOW_MS && age > -LIVE_CLOCK_SKEW_MS;
}

export function resolveBuddyIsOnline(input: {
  rightNow: BuddyDashboardResponse["rightNow"] | null | undefined;
  presenceUpdatedAt?: string | null;
  gyanPresenceUpdatedAt?: string | null;
  sitePresenceUpdatedAt?: string | null;
  latestDwellAt?: string | null;
}): boolean {
  const heartbeatWindowMs = 60_000;

  if (input.sitePresenceUpdatedAt) {
    const age = Date.now() - Date.parse(input.sitePresenceUpdatedAt);
    return Number.isFinite(age) && age >= 0 && age <= heartbeatWindowMs;
  }

  // Fallback for extremely fresh context updates (<= 30s) if sitePresenceUpdatedAt is missing
  const fallbackWindowMs = 30_000;

  if (input.presenceUpdatedAt) {
    const age = Date.now() - Date.parse(input.presenceUpdatedAt);
    if (Number.isFinite(age) && age >= 0 && age <= fallbackWindowMs) return true;
  }
  if (input.gyanPresenceUpdatedAt) {
    const age = Date.now() - Date.parse(input.gyanPresenceUpdatedAt);
    if (Number.isFinite(age) && age >= 0 && age <= fallbackWindowMs) return true;
  }

  return false;
}
