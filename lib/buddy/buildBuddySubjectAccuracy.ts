import { parseBitsTestAttemptsStore } from "@/lib/play/bits/parseBitsTestAttemptsStore";
import { parseSubjectBreakdownJson } from "@/lib/mock/mockTestAttemptTypes";
import { rollingIstDateRangeInclusive } from "@/lib/rdm/rdmRecentByActivity";
import type { BuddySubjectAccuracySection } from "@/lib/buddy/buddyPrivacy";
import type { Json } from "@/integrations/supabase/types";
import type { Subject } from "@/types";

const PCM: Subject[] = ["physics", "math", "chemistry"];

const SUBJECT_LABEL: Record<Subject, string> = {
  physics: "Physics",
  math: "Maths",
  chemistry: "Chemistry",
};

type MockAttemptRow = {
  created_at: string;
  subject_breakdown: Json;
};

function isWithinIstWeek(iso: string, fromIst: string, toIst: string): boolean {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
  return ymd >= fromIst && ymd <= toIst;
}

/** Buddy Subject accuracy card: PCM rollup from topic quizzes + mocks (IST calendar week). */
export function buildBuddySubjectAccuracyWeek(input: {
  bitsAttemptsJson: Json | null | undefined;
  mockAttempts: MockAttemptRow[];
}): BuddySubjectAccuracySection | null {
  const { fromIst, toIst } = rollingIstDateRangeInclusive(7);
  const totals = new Map<Subject, { correct: number; total: number }>();
  for (const s of PCM) totals.set(s, { correct: 0, total: 0 });

  for (const row of parseBitsTestAttemptsStore(input.bitsAttemptsJson)) {
    if (row.submittedAtMs == null) continue;
    if (!isWithinIstWeek(new Date(row.submittedAtMs).toISOString(), fromIst, toIst)) {
      continue;
    }
    const answered = row.correctCount + row.wrongCount;
    if (answered <= 0) continue;
    const bucket = totals.get(row.subject)!;
    bucket.correct += row.correctCount;
    bucket.total += answered;
  }

  for (const attempt of input.mockAttempts) {
    if (!isWithinIstWeek(attempt.created_at, fromIst, toIst)) continue;
    for (const slice of parseSubjectBreakdownJson(attempt.subject_breakdown)) {
      const bucket = totals.get(slice.subject);
      if (!bucket) continue;
      bucket.correct += slice.correct;
      bucket.total += slice.total;
    }
  }

  const subjects = PCM.map((subject) => {
    const bucket = totals.get(subject)!;
    const pct = bucket.total > 0 ? Math.round((100 * bucket.correct) / bucket.total) : null;
    return {
      subject,
      name: SUBJECT_LABEL[subject],
      pct: pct ?? 0,
      hasData: bucket.total > 0,
    };
  });

  const anyData = subjects.some((s) => s.hasData);
  if (!anyData) return null;

  return { subjects };
}
