"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getClientApiAuthHeaders } from "@/lib/auth/clientApiAuth";
import { EDUBLAST_STUDY_DAYS_REFRESH } from "@/lib/dashboard/studyDayBumpEvents";
import {
  addDaysLocal,
  localDayKeyFromDate,
  startOfLocalDay,
} from "@/lib/dashboard/dashboardDayActivity";
import { computeStudyStreakFromDayMs } from "@/lib/dashboard/studyStreakClient";

/**
 * Study streak from the same `/api/user/study-days` source as the dashboard (saved play + quiz time).
 *
 * No Realtime subscription here on purpose: own-user writes already dispatch
 * `EDUBLAST_STUDY_DAYS_REFRESH` via `notifyStudyDaysRefresh()` and `SitePresenceProvider`,
 * and the focus listener catches cross-tab/cross-device edits. Avoiding the extra channel
 * keeps Realtime peak-connection cost down on Supabase Pro/MICRO.
 */
export function useStudyStreakFromApi(): { streakDays: number; ready: boolean } {
  const { profile } = useAuth();
  const [streakDays, setStreakDays] = useState(0);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    if (!profile?.id) {
      setStreakDays(0);
      setReady(false);
      return;
    }
    await Promise.resolve();
    try {
      const headers = await getClientApiAuthHeaders();
      const todayStart = startOfLocalDay(new Date());
      const toStr = localDayKeyFromDate(todayStart);
      const fromStr = localDayKeyFromDate(addDaysLocal(todayStart, -45));
      const res = await fetch(`/api/user/study-days?from=${fromStr}&to=${toStr}&today=${toStr}`, {
        headers,
      });
      if (!res.ok) return;
      const json = (await res.json()) as {
        days?: { day: string; active_ms: number }[];
        summary?: { streak?: number } | null;
      };
      const s = json.summary;
      if (s && typeof s.streak === "number") {
        setStreakDays(Math.max(0, s.streak));
      } else {
        const map = new Map<string, number>();
        for (const row of json.days ?? []) {
          if (row?.day && typeof row.active_ms === "number" && row.active_ms >= 0) {
            map.set(row.day, Math.max(0, row.active_ms));
          }
        }
        setStreakDays(computeStudyStreakFromDayMs(map, toStr).streak);
      }
      setReady(true);
    } catch {
      /* keep last streak */
    }
  }, [profile?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onRefresh = () => void load();
    window.addEventListener(EDUBLAST_STUDY_DAYS_REFRESH, onRefresh);
    window.addEventListener("focus", onRefresh);
    return () => {
      window.removeEventListener(EDUBLAST_STUDY_DAYS_REFRESH, onRefresh);
      window.removeEventListener("focus", onRefresh);
    };
  }, [load]);

  return { streakDays, ready };
}
