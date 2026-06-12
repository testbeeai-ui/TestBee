"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchBuddyActivitySignal,
  fetchBuddyDashboard,
  type BuddyAdvancedDashboardResponse,
  type BuddyProfile,
} from "@/lib/buddy/buddyClient";
import { EDUBLAST_BUDDY_ACTIVITY_REFRESH } from "@/lib/buddy/buddyActivityEvents";
import {
  BUDDY_FULL_REFRESH_MS,
  BUDDY_REALTIME_DEBOUNCE_MS,
  BUDDY_SIGNAL_POLL_MS,
} from "@/lib/dashboard/connectionRealtimeConstants";

type UseBuddyDashboardLiveResult = {
  data: BuddyAdvancedDashboardResponse | null;
  error: string | null;
  refresh: () => void;
};

export function useBuddyDashboardLive(buddy: BuddyProfile): UseBuddyDashboardLiveResult {
  const [data, setData] = useState<BuddyAdvancedDashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const revisionRef = useRef<string | null>(null);
  const loadGenRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const realtimeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadFull = useCallback(
    async (opts?: { showLoading?: boolean }) => {
      const gen = ++loadGenRef.current;
      if (opts?.showLoading) {
        setError(null);
        setData(null);
      }
      try {
        const result = await fetchBuddyDashboard(buddy.id);
        if (gen !== loadGenRef.current) return;
        setData(result);
        setError(null);
      } catch (err) {
        if (gen !== loadGenRef.current) return;
        if (opts?.showLoading) {
          setError(err instanceof Error ? err.message : "Could not load buddy data.");
        }
      }
    },
    [buddy.id]
  );

  const scheduleFullLoad = useCallback(
    (opts?: { showLoading?: boolean }) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        void loadFull(opts);
      }, 400);
    },
    [loadFull]
  );

  const checkSignalAndMaybeLoad = useCallback(async () => {
    try {
      const signal = await fetchBuddyActivitySignal(buddy.id);
      if (revisionRef.current === signal.revision) return;
      revisionRef.current = signal.revision;
      scheduleFullLoad();
    } catch {
      /* non-fatal — next poll or realtime will retry */
    }
  }, [buddy.id, scheduleFullLoad]);

  const scheduleSignalCheck = useCallback(() => {
    if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current);
    realtimeDebounceRef.current = setTimeout(() => {
      realtimeDebounceRef.current = null;
      void checkSignalAndMaybeLoad();
    }, BUDDY_REALTIME_DEBOUNCE_MS);
  }, [checkSignalAndMaybeLoad]);

  const refresh = useCallback(() => {
    revisionRef.current = null;
    void loadFull({ showLoading: true });
  }, [loadFull]);

  useLayoutEffect(() => {
    revisionRef.current = null;
    setData(null);
    setError(null);
  }, [buddy.id]);

  useEffect(() => {
    revisionRef.current = null;
    void (async () => {
      await loadFull({ showLoading: true });
      try {
        const signal = await fetchBuddyActivitySignal(buddy.id);
        revisionRef.current = signal.revision;
      } catch {
        /* initial signal optional */
      }
    })();

    // Phase 3: one Realtime table (site heartbeat). Learning/gyan/dwell covered by activity-signal poll.
    const channel = supabase
      .channel(`buddy_presence:${buddy.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "student_site_presence",
          filter: `user_id=eq.${buddy.id}`,
        },
        () => {
          scheduleSignalCheck();
        }
      )
      .subscribe();

    const signalInterval = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void checkSignalAndMaybeLoad();
    }, BUDDY_SIGNAL_POLL_MS);

    const fullInterval = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      scheduleFullLoad();
    }, BUDDY_FULL_REFRESH_MS);

    const onFocus = () => {
      void checkSignalAndMaybeLoad();
    };
    const onBuddyActivity = () => {
      revisionRef.current = null;
      scheduleFullLoad();
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener(EDUBLAST_BUDDY_ACTIVITY_REFRESH, onBuddyActivity);

    return () => {
      loadGenRef.current += 1;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(EDUBLAST_BUDDY_ACTIVITY_REFRESH, onBuddyActivity);
      window.clearInterval(signalInterval);
      window.clearInterval(fullInterval);
      void supabase.removeChannel(channel);
    };
  }, [buddy.id, loadFull, scheduleFullLoad, checkSignalAndMaybeLoad, scheduleSignalCheck]);

  return { data, error, refresh };
}
