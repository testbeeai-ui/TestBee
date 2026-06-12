"use client";

import { useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TEACHER_PORTAL_POLL_MS } from "@/lib/dashboard/connectionRealtimeConstants";

/** Polling while the teacher portal is open — backs up Realtime if the connection drops. */
const POLL_INTERVAL_MS = TEACHER_PORTAL_POLL_MS;
/** Batch rapid DB events into one bundle reload. */
const REALTIME_DEBOUNCE_MS = 650;

/**
 * Keeps `loadTeacherPortalBundle` fresh while the teacher portal is open (any section):
 * - Supabase Realtime on student attempt + task-progress rows (respects RLS)
 * - Refresh when the tab becomes visible or the window gains focus
 * - Light interval polling only while the document is visible
 *
 * Admin impersonation skips Realtime (session is the admin; bundle loads via API).
 */
export function useTeacherPortalBundleAutoRefresh(opts: {
  teacherUserId: string | null | undefined;
  enabled: boolean;
  skipRealtime: boolean;
  refresh: (opts?: { silent?: boolean }) => Promise<void>;
}) {
  const { teacherUserId, enabled, skipRealtime, refresh } = opts;
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleSilentRefresh = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      void refreshRef.current({ silent: true });
    }, REALTIME_DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const runIfVisible = () => {
      if (document.visibilityState !== "visible") return;
      void refreshRef.current({ silent: true });
    };
    document.addEventListener("visibilitychange", runIfVisible);
    window.addEventListener("focus", runIfVisible);
    return () => {
      document.removeEventListener("visibilitychange", runIfVisible);
      window.removeEventListener("focus", runIfVisible);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void refreshRef.current({ silent: true });
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [enabled]);

  useEffect(() => {
    if (!enabled || skipRealtime || !teacherUserId?.trim()) return;

    const channel = supabase
      .channel(`teacher_portal_bundle:${teacherUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "classroom_generated_test_attempts",
        },
        () => scheduleSilentRefresh()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "classroom_assignment_task_progress",
        },
        () => scheduleSilentRefresh()
      )
      .subscribe();

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [enabled, skipRealtime, teacherUserId, scheduleSilentRefresh]);
}
