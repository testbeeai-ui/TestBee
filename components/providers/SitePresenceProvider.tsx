"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { fetchWithClientAuth, getClientApiAuthHeaders } from "@/lib/auth/clientApiAuth";
import { notifyStudyDaysRefresh } from "@/lib/dashboard/studyDayBumpEvents";
import { invalidateStudyDaysCache } from "@/lib/dashboard/studyDaysClient";
import { localStudyCalendarDay } from "@/lib/dashboard/studyDayBump";
import { SITE_PRESENCE_HEARTBEAT_MS } from "@/lib/dashboard/sitePresenceConstants";

const SitePresenceLiveContext = createContext(0);

export function useSitePresenceLiveMsToday(): number {
  return useContext(SitePresenceLiveContext);
}

let sitePresenceHeartbeatInFlight = false;
let lastOnlineSitePresenceAt = 0;
let studyDaysPresenceInFlight = false;
let lastStudyDaysPresencePostAt = 0;
/** Match server batching — avoid back-to-back presence_ms POSTs from flush loops / remounts. */
const MIN_STUDY_DAYS_PRESENCE_GAP_MS = 22_000;

async function postPresenceDelta(day: string, deltaMs: number): Promise<boolean> {
  const capped = Math.min(Math.max(1, Math.trunc(deltaMs)), 5 * 60 * 1000);
  const now = Date.now();
  if (studyDaysPresenceInFlight) return false;
  if (now - lastStudyDaysPresencePostAt < MIN_STUDY_DAYS_PRESENCE_GAP_MS) return false;
  studyDaysPresenceInFlight = true;
  try {
    const res = await fetchWithClientAuth("/api/user/study-days", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ day, deltaPresenceMs: capped }),
    });
    if (!res.ok) return false;
    lastStudyDaysPresencePostAt = Date.now();
    invalidateStudyDaysCache();
    notifyStudyDaysRefresh();
    return true;
  } catch {
    return false;
  } finally {
    studyDaysPresenceInFlight = false;
  }
}

async function postSitePresence(offline = false, signedOut = false, forceOnline = false) {
  if (!offline) {
    const age = Date.now() - lastOnlineSitePresenceAt;
    if (!forceOnline && age >= 0 && age < SITE_PRESENCE_HEARTBEAT_MS - 2_000) return;
    if (sitePresenceHeartbeatInFlight) return;
  }

  const run = async () => {
    try {
      const init: RequestInit = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offline, signedOut: signedOut || undefined }),
      };
      if (offline) {
        init.keepalive = true;
        const auth = await getClientApiAuthHeaders();
        if (auth.Authorization) {
          init.headers = { ...init.headers, Authorization: auth.Authorization };
        }
        void fetch("/api/user/site-presence", init).catch(() => {});
        return;
      }
      sitePresenceHeartbeatInFlight = true;
      try {
        await fetchWithClientAuth("/api/user/site-presence", init);
        lastOnlineSitePresenceAt = Date.now();
      } finally {
        sitePresenceHeartbeatInFlight = false;
      }
    } catch {
      // Non-fatal presence error
    }
  };

  if (offline) {
    await run();
    return;
  }
  void run();
}

interface TabInfo {
  lastActive: number;
  visible: boolean;
}

type TabMap = Record<string, TabInfo>;

/**
 * Coordinates tab visibility/active state across multiple open tabs/pages for the user session.
 * Returns the count of remaining active visible tabs to prevent offline presence leaks when a single
 * tab is hidden or closed while other tabs remain active/visible.
 */
function updateTabPresenceState(
  userId: string,
  tabId: string,
  visible: boolean,
  isRemoving = false
): { activeVisibleCount: number; otherVisibleCount: number } {
  if (typeof window === "undefined") {
    return { activeVisibleCount: 0, otherVisibleCount: 0 };
  }
  const key = `eb_tabs_${userId}`;
  let tabs: TabMap = {};
  try {
    const val = localStorage.getItem(key);
    if (val) {
      tabs = JSON.parse(val) as TabMap;
    }
  } catch {
    // Ignore localStorage/JSON parse errors
  }

  const now = Date.now();

  // Prune dead tabs (inactive for > 45 seconds) or corrupted keys
  for (const tid of Object.keys(tabs)) {
    if (tid !== tabId) {
      const info = tabs[tid];
      if (!info || typeof info.lastActive !== "number" || now - info.lastActive > 45_000) {
        delete tabs[tid];
      }
    }
  }

  if (isRemoving) {
    delete tabs[tabId];
  } else {
    tabs[tabId] = {
      lastActive: now,
      visible,
    };
  }

  try {
    localStorage.setItem(key, JSON.stringify(tabs));
  } catch {
    // Ignore localStorage write errors
  }

  // Count active visible tabs
  let activeVisibleCount = 0;
  let otherVisibleCount = 0;

  for (const tid of Object.keys(tabs)) {
    const info = tabs[tid];
    if (info?.visible && now - info.lastActive <= 45_000) {
      activeVisibleCount++;
      if (tid !== tabId) {
        otherVisibleCount++;
      }
    }
  }

  return { activeVisibleCount, otherVisibleCount };
}

/**
 * Tracks time while this browser tab is in the foreground and syncs `presence_ms` in Supabase.
 * Pauses when the tab is hidden. Study streak in the database still uses `active_ms` (quiz + play) only.
 */
export function SitePresenceProvider({
  userId,
  children,
}: {
  userId: string | null;
  children: ReactNode;
}) {
  const [liveMs, setLiveMs] = useState(0);
  const unsentMsRef = useRef(0);
  const lastTickRef = useRef<number | null>(null);
  const dayKeyRef = useRef(localStudyCalendarDay());
  /** Avoid overlapping POSTs (interval + visibility + unmount can fire together). */
  const flushInFlightRef = useRef(false);

  // Generate a stable unique ID for this tab instance
  const tabIdRef = useRef<string>("");
  if (!tabIdRef.current) {
    tabIdRef.current = Math.random().toString(36).slice(2, 11);
  }
  const tabId = tabIdRef.current;

  const tryFlush = useCallback(async () => {
    if (flushInFlightRef.current) return;
    flushInFlightRef.current = true;
    try {
      const day = dayKeyRef.current;
      let remain = unsentMsRef.current;
      if (remain < 2000) return;
      while (remain >= 2000) {
        const chunk = Math.min(remain, 5 * 60 * 1000);
        const ok = await postPresenceDelta(day, chunk);
        if (!ok) break;
        remain -= chunk;
      }
      unsentMsRef.current = remain;
      setLiveMs(Math.floor(remain));
    } finally {
      flushInFlightRef.current = false;
    }
  }, []);

  const lastHeartbeatTime = useRef<number>(0);
  const offlineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!userId) {
      unsentMsRef.current = 0;
      lastTickRef.current = null;
      setLiveMs(0);
      return;
    }

    const isVisible = typeof document !== "undefined" && document.visibilityState === "visible";

    // Immediately post site presence as online when starting (if currently visible)
    lastHeartbeatTime.current = Date.now();
    updateTabPresenceState(userId, tabId, isVisible, false);
    if (isVisible) {
      void postSitePresence(false, false, true);
    }

    const rollDayIfNeeded = () => {
      const next = localStudyCalendarDay();
      if (next !== dayKeyRef.current) {
        void tryFlush();
        dayKeyRef.current = next;
        unsentMsRef.current = 0;
        lastTickRef.current =
          typeof document !== "undefined" && document.visibilityState === "visible"
            ? performance.now()
            : null;
        setLiveMs(0);
      }
    };

    const cancelScheduledOffline = () => {
      if (offlineTimerRef.current) {
        clearTimeout(offlineTimerRef.current);
        offlineTimerRef.current = null;
      }
    };

    const scheduleSoftOffline = () => {
      cancelScheduledOffline();
      offlineTimerRef.current = setTimeout(() => {
        offlineTimerRef.current = null;
        const { activeVisibleCount } = updateTabPresenceState(userId, tabId, false, true);
        if (activeVisibleCount === 0) void postSitePresence(true);
      }, 8000);
    };

    const onVis = () => {
      rollDayIfNeeded();
      const visible = document.visibilityState === "visible";
      if (visible) {
        cancelScheduledOffline();
        lastTickRef.current = performance.now();
        lastHeartbeatTime.current = Date.now();
        updateTabPresenceState(userId, tabId, true, false);
        void postSitePresence(false, false, true);
      } else {
        lastTickRef.current = null;
        void tryFlush();
        updateTabPresenceState(userId, tabId, false, false);
        scheduleSoftOffline();
      }
    };

    const onHide = () => {
      lastTickRef.current = null;
      void tryFlush();
      updateTabPresenceState(userId, tabId, false, true);
      scheduleSoftOffline();
    };

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onHide);

    if (document.visibilityState === "visible") {
      lastTickRef.current = performance.now();
    }

    const iv = setInterval(() => {
      rollDayIfNeeded();
      const now = performance.now();

      if (document.visibilityState === "visible") {
        const timeSinceHeartbeat = Date.now() - lastHeartbeatTime.current;
        if (timeSinceHeartbeat >= SITE_PRESENCE_HEARTBEAT_MS) {
          lastHeartbeatTime.current = Date.now();
          updateTabPresenceState(userId, tabId, true, false);
          void postSitePresence(false, false, false);
        }
      }

      if (document.visibilityState !== "visible" || lastTickRef.current == null) {
        setLiveMs(Math.floor(unsentMsRef.current));
        return;
      }
      const dt = Math.min(now - lastTickRef.current, 120_000);
      lastTickRef.current = now;
      unsentMsRef.current += dt;
      const floored = Math.floor(unsentMsRef.current);
      setLiveMs((prev) => (prev === floored ? prev : floored));
      if (unsentMsRef.current >= 30_000) {
        void tryFlush();
      }
    }, 1000);

    setLiveMs(Math.floor(unsentMsRef.current));

    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onHide);
      clearInterval(iv);
      cancelScheduledOffline();
      if (document.visibilityState === "visible" && lastTickRef.current != null) {
        unsentMsRef.current += Math.min(performance.now() - lastTickRef.current, 120_000);
        lastTickRef.current = null;
      }
      void tryFlush();
      updateTabPresenceState(userId, tabId, false, true);
      scheduleSoftOffline();
    };
  }, [userId, tabId, tryFlush]);

  const value = useMemo(() => liveMs, [liveMs]);

  return (
    <SitePresenceLiveContext.Provider value={value}>{children}</SitePresenceLiveContext.Provider>
  );
}
