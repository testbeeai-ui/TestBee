export const TEACHER_ASSIGNMENT_SCORES_CACHE_LS = "teacherPortal.assignmentScoresCache.v1";

export type TeacherWizardScoreRow = {
  userId: string;
  score: number;
  total: number;
  submittedAt: string | null;
};

export function mergeTeacherWizardScores(
  prev: TeacherWizardScoreRow[],
  incoming: TeacherWizardScoreRow[]
): TeacherWizardScoreRow[] {
  const byUserId = new Map<string, TeacherWizardScoreRow>();
  for (const row of prev) byUserId.set(row.userId, row);
  for (const next of incoming) {
    const existing = byUserId.get(next.userId);
    if (!existing) {
      byUserId.set(next.userId, next);
      continue;
    }
    const existingTs = existing.submittedAt ? new Date(existing.submittedAt).getTime() : -1;
    const nextTs = next.submittedAt ? new Date(next.submittedAt).getTime() : -1;
    byUserId.set(next.userId, nextTs >= existingTs ? next : existing);
  }
  return Array.from(byUserId.values()).sort((a, b) => {
    const aTs = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
    const bTs = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
    return bTs - aTs;
  });
}

export function readTeacherWizardScoresCache(cacheId: string): {
  scores: TeacherWizardScoreRow[];
  updatedAt: string;
} | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(TEACHER_ASSIGNMENT_SCORES_CACHE_LS);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<
      string,
      { scores: TeacherWizardScoreRow[]; updatedAt: string }
    >;
    const row = parsed[cacheId];
    if (!row?.scores) return null;
    return { scores: row.scores, updatedAt: row.updatedAt };
  } catch {
    return null;
  }
}

export function writeTeacherWizardScoresCache(
  cacheId: string,
  scores: TeacherWizardScoreRow[],
  updatedAt: string
) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(TEACHER_ASSIGNMENT_SCORES_CACHE_LS);
    const parsed = (raw ? JSON.parse(raw) : {}) as Record<
      string,
      { scores: TeacherWizardScoreRow[]; updatedAt: string }
    >;
    parsed[cacheId] = { scores, updatedAt };
    window.localStorage.setItem(TEACHER_ASSIGNMENT_SCORES_CACHE_LS, JSON.stringify(parsed));
  } catch {
    // ignore quota / private mode
  }
}
