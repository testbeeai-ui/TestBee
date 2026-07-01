"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchWithClientAuth } from "@/lib/auth/clientApiAuth";
import type { TeacherPlanKey } from "@/lib/teacherPortal/teacherPlan";

export type TeacherPlanQuotaShape = {
  allowed: boolean;
  remaining: number;
  cap: number;
  isOverage?: boolean;
};

export type TeacherPlanLimitsState = {
  tier: TeacherPlanKey;
  assignments: TeacherPlanQuotaShape;
  liveClasses: TeacherPlanQuotaShape;
  overage: { assignmentRdm: number; liveClassRdm: number };
  usage: { assignmentsCreatedThisMonth: number; liveClassesBookedThisMonth: number };
};

const DEFAULT_OVERAGE = { assignmentRdm: 20, liveClassRdm: 100 };

export function useTeacherPlanLimits(enabled = true) {
  const [loading, setLoading] = useState(enabled);
  const [limits, setLimits] = useState<TeacherPlanLimitsState | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const res = await fetchWithClientAuth("/api/teacher/plan/limits");
      const body = (await res.json()) as {
        tier?: TeacherPlanKey;
        assignments?: TeacherPlanQuotaShape;
        liveClasses?: TeacherPlanQuotaShape;
        overage?: { assignmentRdm?: number; liveClassRdm?: number };
        usage?: {
          assignmentsCreatedThisMonth?: number;
          liveClassesBookedThisMonth?: number;
        };
      };
      if (!res.ok || !body.assignments || !body.liveClasses) {
        setLimits(null);
        return;
      }
      setLimits({
        tier: body.tier ?? "free",
        assignments: body.assignments,
        liveClasses: body.liveClasses,
        overage: {
          assignmentRdm: body.overage?.assignmentRdm ?? DEFAULT_OVERAGE.assignmentRdm,
          liveClassRdm: body.overage?.liveClassRdm ?? DEFAULT_OVERAGE.liveClassRdm,
        },
        usage: {
          assignmentsCreatedThisMonth: body.usage?.assignmentsCreatedThisMonth ?? 0,
          liveClassesBookedThisMonth: body.usage?.liveClassesBookedThisMonth ?? 0,
        },
      });
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { loading, limits, refresh };
}
