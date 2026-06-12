import { SITE_PRESENCE_HEARTBEAT_MS } from "@/lib/dashboard/sitePresenceConstants";

/** Buddy panel: revision poll interval — aligned with site-presence heartbeat. */
export const BUDDY_SIGNAL_POLL_MS = SITE_PRESENCE_HEARTBEAT_MS;

/** Buddy panel: occasional full dashboard refresh (Gyan / Play / MCQ tiles). */
export const BUDDY_FULL_REFRESH_MS = 8 * 60 * 1000;

/** Debounce rapid Realtime events before hitting activity-signal API. */
export const BUDDY_REALTIME_DEBOUNCE_MS = 500;

/** Teacher portal backup poll while the tab is open (Realtime is primary). */
export const TEACHER_PORTAL_POLL_MS = 120_000;
