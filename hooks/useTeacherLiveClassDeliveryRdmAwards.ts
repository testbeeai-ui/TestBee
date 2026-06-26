"use client";

import { useCallback, useEffect, useRef } from "react";
import { fetchWithClientAuth } from "@/lib/auth/clientApiAuth";
import { formatLiveClassDeliveryRdmBreakdown } from "@/lib/teacherPortal/liveClassDeliveryRdm";
import type { LiveClassDeliveryAwardResult } from "@/lib/teacherPortal/liveClassDeliveryRdm";

type AwardApiResponse = {
  ok?: boolean;
  awardedCount?: number;
  awards?: LiveClassDeliveryAwardResult[];
  error?: string;
};

const STORAGE_PREFIX = "teacherPortal.liveClassDeliveryToast.v1:";

function toastKeyForOccurrence(userId: string, sectionId: string, occurrenceAt: string): string {
  return `${STORAGE_PREFIX}${userId}:${sectionId}:${occurrenceAt}`;
}

function hasSeenToast(userId: string, sectionId: string, occurrenceAt: string): boolean {
  try {
    return window.sessionStorage.getItem(toastKeyForOccurrence(userId, sectionId, occurrenceAt)) === "1";
  } catch {
    return false;
  }
}

function markToastSeen(userId: string, sectionId: string, occurrenceAt: string): void {
  try {
    window.sessionStorage.setItem(toastKeyForOccurrence(userId, sectionId, occurrenceAt), "1");
  } catch {
    // ignore
  }
}

/**
 * On teacher portal load / refocus: auto-grant delivery RDM for ended section
 * schedule occurrences (Path A) and surface a toast when credits land.
 */
export function useTeacherLiveClassDeliveryRdmAwards(opts: {
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
      const res = await fetchWithClientAuth("/api/teacher/section-schedule/award-delivery-rdm", {
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
        const total = typeof award.total_rdm === "number" ? award.total_rdm : 0;
        if (!sectionId || !occurrenceAt || total <= 0 || hasSeenToast(userId, sectionId, occurrenceAt)) {
          continue;
        }
        markToastSeen(userId, sectionId, occurrenceAt);
        anyNew = true;
        const title =
          typeof award.title === "string" && award.title.trim()
            ? award.title.trim()
            : "Live class";
        const breakdown = formatLiveClassDeliveryRdmBreakdown({
          studentCount: award.student_count ?? 0,
          cappedStudentCount: award.capped_student_count ?? 0,
          baseRdm: award.base_rdm ?? 0,
          perStudentRdm: award.per_student_rdm ?? 0,
          studentBonusRdm: award.student_bonus_rdm ?? 0,
          totalRdm: total,
        });
        toastRef.current({
          title: `+${total} RDM · Section schedule class`,
          description: `${title} — ${breakdown}`,
        });
      }

      if (anyNew) {
        onAwardedRef.current?.();
      }
    } catch {
      // Non-blocking: portal still works if award check fails.
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
