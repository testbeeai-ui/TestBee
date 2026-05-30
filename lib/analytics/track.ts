/**
 * Unified client-side event tracking.
 * Usage: import { track } from "@/lib/analytics/track";
 *        track("onboarding_completed", { role: "student" });
 */

let _sessionId: string | null = null;

function getSessionId(): string {
  if (_sessionId) return _sessionId;
  try {
    const key = "edublast_session_id";
    let sid = sessionStorage.getItem(key);
    if (!sid) {
      sid = crypto.randomUUID();
      sessionStorage.setItem(key, sid);
    }
    _sessionId = sid;
  } catch {
    _sessionId = crypto.randomUUID();
  }
  return _sessionId;
}

/**
 * Track a student event. Fire-and-forget ΓÇö does not block or throw.
 */
export function track(eventName: string, data?: Record<string, unknown>, userId?: string): void {
  try {
    const body = JSON.stringify({
      event_name: eventName,
      event_data: data ?? {},
      page: typeof window !== "undefined" ? window.location.pathname : null,
      session_id: getSessionId(),
    });

    // Use sendBeacon when available (survives page unload), fall back to fetch
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon("/api/user/track", blob);
    } else {
      fetch("/api/user/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // Silently fail ΓÇö tracking must never break the app
  }
}

let lastPageViewKey: string | null = null;
let lastPageViewAt = 0;
const PAGE_VIEW_DEDUPE_MS = 5_000;

/**
 * Track a page view. Call this from a route change listener.
 */
export function trackPageView(path: string): void {
  const now = Date.now();
  if (lastPageViewKey === path && now - lastPageViewAt < PAGE_VIEW_DEDUPE_MS) {
    return;
  }
  lastPageViewKey = path;
  lastPageViewAt = now;
  track("page_view", { path });
}
