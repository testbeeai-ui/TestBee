"use client";

import { useCallback, useEffect, useRef } from "react";
import { fetchWithClientAuth } from "@/lib/auth/clientApiAuth";
import { formatStarsX10 } from "@/lib/teacherPortal/liveClassQualityRdm";
import type { LiveClassQualityAwardResult } from "@/lib/teacherPortal/liveClassQualityRdm";

type AwardApiResponse = {
  ok?: boolean;
  awardedCount?: number;
  awards?: LiveClassQualityAwardResult[];
  error?: string;
};

const STORAGE_PREFIX = "teacherPortal.liveClassQualityToast.v1:";

function toastKey(userId: string, sectionId: string, occurrenceAt: string): string {
  return `${STORAGE_PREFIX}${userId}:${sectionId}:${occurrenceAt}`;
}

function hasSeenToast(userId: string, sectionId: string, occurrenceAt: string): boolean {
  try {
    return window.sessionStorage.getItem(toastKey(userId, sectionId, occurrenceAt)) === "1";
  } catch {
    return false;
  }
}

function markToastSeen(userId: string, sectionId: string, occurrenceAt: string): void {
  try {
    window.sessionStorage.setItem(toastKey(userId, sectionId, occurrenceAt), "1");
  } catch {
    // ignore
  }
}

/**
 * On teacher portal load / refocus: auto-grant the CREDIT-ONLY quality bonus for
 * section schedule occurrences whose ratings window has closed and that scored
 * highly enough, then surface a toast when credits land.
 */
export function useTeacherLiveClassQualityRdmAwards(opts: {
  teacherUserId: string | null | undefined;
  enabled: boolean;
  toast: (input: {
    title: string;
    description?: string;
    variant?: "default" | "destructive";
  }) => void;
  onAwarded?: () => void;
}) {
  const { teacherUserId, enabled, toast, onAwarded } = opts;
  const inflightRef = useRef(false);
  const toastRef = useRef(toast);
  const onAwardedRef = useRef(onAwarded);
  toastRef.current = toast;
  onAwardedRef.current = onAwarded;

  const run = useCallback(async () => {
    const userId = teacherUserId?.trim();
    if (!userId || !enabled || inflightRef.current) return;
    inflightRef.current = true;
    try {
      const res = await fetchWithClientAuth("/api/teacher/section-schedule/award-quality-rdm", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const payload = (await res.json().catch(() => ({}))) as AwardApiResponse;
      if (!res.ok || !payload.ok) return;

      const awards = Array.isArray(payload.awards) ? payload.awards : [];
      let anyNew = false;
      for (const award of awards) {
        const sectionId = award.section_id?.trim();
        const occurrenceAt = award.occurrence_at?.trim();
        const bonus = typeof award.quality_bonus_rdm === "number" ? award.quality_bonus_rdm : 0;
        if (!sectionId || !occurrenceAt || bonus <= 0 || hasSeenToast(userId, sectionId, occurrenceAt)) {
          continue;
        }
        markToastSeen(userId, sectionId, occurrenceAt);
        anyNew = true;
        const title =
          typeof award.title === "string" && award.title.trim() ? award.title.trim() : "Live class";
        const stars = formatStarsX10(award.adjusted_x10 ?? 0);
        const count = award.rating_count ?? 0;
        toastRef.current({
          title: `+${bonus} RDM · Class quality bonus`,
          description: `${title} — ${stars}★ from ${count} ratings`,
        });
      }

      if (anyNew) {
        onAwardedRef.current?.();
      }
    } catch {
      // Non-blocking: portal still works if the quality check fails.
    } finally {
      inflightRef.current = false;
    }
  }, [enabled, teacherUserId]);

  useEffect(() => {
    if (!enabled || !teacherUserId?.trim()) return;
    void run();
  }, [enabled, run, teacherUserId]);

  useEffect(() => {
    if (!enabled || !teacherUserId?.trim()) return;
    const onFocus = () => {
      if (document.visibilityState !== "visible") return;
      void run();
    };
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
  }, [enabled, run, teacherUserId]);
}
