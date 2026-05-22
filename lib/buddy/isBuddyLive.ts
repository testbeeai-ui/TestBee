import type { BuddyDashboardResponse } from "@/lib/buddy/buddyClient";
import { resolveBuddyIsOnline } from "@/lib/buddy/buddyPresence";

/** Buddy is actively on-site for the Learning Buddy “Online now” badge. */
export function isBuddyLive(
  rightNow: BuddyDashboardResponse["rightNow"] | null | undefined,
  signals?: {
    presenceUpdatedAt?: string | null;
    gyanPresenceUpdatedAt?: string | null;
    latestDwellAt?: string | null;
  }
): boolean {
  return resolveBuddyIsOnline({
    rightNow,
    presenceUpdatedAt: signals?.presenceUpdatedAt,
    gyanPresenceUpdatedAt: signals?.gyanPresenceUpdatedAt,
    latestDwellAt: signals?.latestDwellAt,
  });
}
