import type { DailyChecklistApiResponse } from "@/core/domain/checklist";
import { localDayBoundsIso } from "@/core/dates/localDay";
import { apiJson } from "./client";

export type StudyDaysApiResponse = {
  days?: { day: string; active_ms: number; presence_ms?: number }[];
  summary?: { streak?: number; activeDaysThisMonth?: number } | null;
  error?: string;
};

export const dashboardApi = {
  getDailyChecklist(subjects: string[] = ["physics", "chemistry", "math"]) {
    const { today, dayStart, dayEnd } = localDayBoundsIso();
    const q = new URLSearchParams({
      today,
      dayStart,
      dayEnd,
      subjects: subjects.join(","),
    });
    return apiJson<DailyChecklistApiResponse>(`/api/user/daily-checklist?${q.toString()}`);
  },

  getStudyDays(from: string, to: string, today: string) {
    const q = new URLSearchParams({ from, to, today });
    return apiJson<StudyDaysApiResponse>(`/api/user/study-days?${q.toString()}`);
  },
};
