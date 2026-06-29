"use client";

import { useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TEACHER_PORTAL_POLL_MS } from "@/lib/dashboard/connectionRealtimeConstants";

/** Rare safety-net poll if Realtime disconnects (not the primary update path). */
const POLL_INTERVAL_MS = TEACHER_PORTAL_POLL_MS;
/** Batch rapid DB events into one bundle reload. */
const REALTIME_DEBOUNCE_MS = 650;

/**
 * Keeps `loadTeacherPortalBundle` fresh while the teacher portal is open:
 * - **Primary:** Supabase Realtime on student attempts + task-progress (one debounced refresh per burst)
 * - **Fallback:** tab focus / visibility + long-interval poll (120s default)
 *
 * No per-card polling — student submit → DB row → Realtime → single silent bundle reload.
 */
export function useTeacherPortalBundleAutoRefresh(opts: {
  teacherUserId: string | null | undefined;
  classroomIds: string[];
  enabled: boolean;
  skipRealtime: boolean;
  refresh: (opts?: { silent?: boolean }) => Promise<void>;
}) {
  const { teacherUserId, classroomIds, enabled, skipRealtime, refresh } = opts;
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const classroomIdsKey = classroomIds.filter(Boolean).sort().join(",");

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

    const channel = supabase.channel(`teacher_portal_bundle:${teacherUserId}:${classroomIdsKey}`);

    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "classroom_assignment_task_progress",
      },
      () => scheduleSilentRefresh()
    );

    for (const classroomId of classroomIds) {
      if (!classroomId.trim()) continue;
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "classroom_generated_test_attempts",
          filter: `classroom_id=eq.${classroomId}`,
        },
        () => scheduleSilentRefresh()
      );
    }

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        void refreshRef.current({ silent: true });
      }
    });

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [
    enabled,
    skipRealtime,
    teacherUserId,
    classroomIdsKey,
    classroomIds,
    scheduleSilentRefresh,
  ]);
}
