"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { fetchWithClientAuth } from "@/lib/clientApiAuth";
import { EDUBLAST_STUDY_DAYS_REFRESH } from "@/lib/studyDayBumpEvents";
import { localStudyCalendarDay } from "@/lib/studyDayBump";

const SitePresenceLiveContext = createContext(0);

export function useSitePresenceLiveMsToday(): number {
  return useContext(SitePresenceLiveContext);
}

async function postPresenceDelta(day: string, deltaMs: number): Promise<boolean> {
  const capped = Math.min(Math.max(1, Math.trunc(deltaMs)), 5 * 60 * 1000);
  try {
    const res = await fetchWithClientAuth("/api/user/study-days", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ day, deltaPresenceMs: capped }),
    });
    if (!res.ok) return false;
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(EDUBLAST_STUDY_DAYS_REFRESH));
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Tracks time while this browser tab is in the foreground and syncs `presence_ms` in Supabase.
 * Pauses when the tab is hidden. Study streak in the database still uses `active_ms` (quiz + play) only.
 */
export function SitePresenceProvider({ userId, children }: { userId: string | null; children: ReactNode }) {
  const [liveMs, setLiveMs] = useState(0);
  const unsentMsRef = useRef(0);
  const lastTickRef = useRef<number | null>(null);
  const dayKeyRef = useRef(localStudyCalendarDay());

  const tryFlush = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    if (!userId) {
      unsentMsRef.current = 0;
      lastTickRef.current = null;
      setLiveMs(0);
      return;
    }

    const rollDayIfNeeded = () => {
      const next = localStudyCalendarDay();
      if (next !== dayKeyRef.current) {
        void tryFlush();
        dayKeyRef.current = next;
        unsentMsRef.current = 0;
        lastTickRef.current =
          typeof document !== "undefined" && document.visibilityState === "visible" ? performance.now() : null;
        setLiveMs(0);
      }
    };

    const onVis = () => {
      rollDayIfNeeded();
      if (document.visibilityState === "visible") {
        lastTickRef.current = performance.now();
      } else {
        lastTickRef.current = null;
        void tryFlush();
      }
    };

    const onHide = () => {
      lastTickRef.current = null;
      void tryFlush();
    };

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onHide);

    if (document.visibilityState === "visible") {
      lastTickRef.current = performance.now();
    }

    const iv = setInterval(() => {
      rollDayIfNeeded();
      const now = performance.now();
      if (document.visibilityState !== "visible" || lastTickRef.current == null) {
        setLiveMs(Math.floor(unsentMsRef.current));
        return;
      }
      const dt = Math.min(now - lastTickRef.current, 120_000);
      lastTickRef.current = now;
      unsentMsRef.current += dt;
      setLiveMs(Math.floor(unsentMsRef.current));
      if (unsentMsRef.current >= 25_000) {
        void tryFlush();
      }
    }, 1000);

    setLiveMs(Math.floor(unsentMsRef.current));

    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onHide);
      clearInterval(iv);
      if (document.visibilityState === "visible" && lastTickRef.current != null) {
        unsentMsRef.current += Math.min(performance.now() - lastTickRef.current, 120_000);
        lastTickRef.current = null;
      }
      void tryFlush();
    };
  }, [userId, tryFlush]);

  const value = useMemo(() => liveMs, [liveMs]);

  return <SitePresenceLiveContext.Provider value={value}>{children}</SitePresenceLiveContext.Provider>;
}
