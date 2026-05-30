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

/** Lightweight revision poll while the panel is open (not a full dashboard fetch). */
/** Match site-presence heartbeat (~20s) so “Online now” updates quickly for viewers. */
const SIGNAL_POLL_MS = 20_000;
/** Recompute buddyOnline from dashboard API (not only activity revision). */
const ONLINE_REFRESH_MS = 20_000;
/** Occasional full refresh for Gyan / Play / MCQ tiles that are not on the presence row. */
const FULL_REFRESH_MS = 5 * 60 * 1000;

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
  }, [scheduleFullLoad]);

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

    const channel = supabase
      .channel(`buddy_presence:${buddy.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "student_learning_presence",
          filter: `user_id=eq.${buddy.id}`,
        },
        () => {
          void checkSignalAndMaybeLoad();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "student_gyan_presence",
          filter: `user_id=eq.${buddy.id}`,
        },
        () => {
          void checkSignalAndMaybeLoad();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "student_site_presence",
          filter: `user_id=eq.${buddy.id}`,
        },
        () => {
          void checkSignalAndMaybeLoad();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "student_learning_dwell_events",
          filter: `user_id=eq.${buddy.id}`,
        },
        () => {
          void checkSignalAndMaybeLoad();
        }
      )
      .subscribe();

    const signalInterval = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void checkSignalAndMaybeLoad();
    }, SIGNAL_POLL_MS);

    const fullInterval = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      scheduleFullLoad();
    }, FULL_REFRESH_MS);

    const onlineInterval = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void loadFull();
    }, ONLINE_REFRESH_MS);

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
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(EDUBLAST_BUDDY_ACTIVITY_REFRESH, onBuddyActivity);
      window.clearInterval(signalInterval);
      window.clearInterval(fullInterval);
      window.clearInterval(onlineInterval);
      void supabase.removeChannel(channel);
    };
  }, [buddy.id, loadFull, scheduleFullLoad, checkSignalAndMaybeLoad]);

  return { data, error, refresh };
}
