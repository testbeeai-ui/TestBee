/**
 * Composite “engagement” % for the profile hub bar — same inputs as
 * `/api/user/profile-attendance-summary`. Each axis is normalized against a
 * soft target, then averaged (equal weight).
 */
export type EngagementSummaryInput = {
  classroomsJoined: number;
  assignmentTasksDone: number;
  dailyDoseDualStreak: number;
  mocksAttempted: number;
  instacueDwellEventsThisWeek: number;
  studyMsTotal: number;
};

/** Soft caps where each axis reaches 100% contribution for that slice. */
const TARGETS = {
  classroomsJoined: 8,
  assignmentTasksDone: 40,
  dailyDoseDualStreak: 30,
  mocksAttempted: 25,
  instacueDwellEventsThisWeek: 80,
  /** Total platform study time — hours equivalent */
  studyHours: 120,
} as const;

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

export function computeStudentEngagementPercent(input: EngagementSummaryInput): number {
  const studyHours = input.studyMsTotal / 3_600_000;
  const parts = [
    clampPct((input.classroomsJoined / TARGETS.classroomsJoined) * 100),
    clampPct((input.assignmentTasksDone / TARGETS.assignmentTasksDone) * 100),
    clampPct((input.dailyDoseDualStreak / TARGETS.dailyDoseDualStreak) * 100),
    clampPct((input.mocksAttempted / TARGETS.mocksAttempted) * 100),
    clampPct((input.instacueDwellEventsThisWeek / TARGETS.instacueDwellEventsThisWeek) * 100),
    clampPct((studyHours / TARGETS.studyHours) * 100),
  ];
  const avg = parts.reduce((a, b) => a + b, 0) / parts.length;
  return Math.round(Math.min(100, avg));
}
