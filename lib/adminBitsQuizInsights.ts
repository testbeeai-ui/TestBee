import type { Subject } from "@/types";
import { stripBitsAttemptSetSuffix } from "@/lib/dashboardChapterCompletion";
import type { EngagementDraftDashboardRow } from "@/lib/parseEngagementDraftDashboardContributions";

/** Cap rows returned in student-insights JSON for attempt audit table. */
export const MAX_BITS_ATTEMPT_DETAILS_ADMIN = 120;

/** Max distinct subtopic labels per subject in rollup chips. */
const MAX_SUBTOPIC_TAGS_PER_SUBJECT = 24;

export type BitsAttemptDetailAdminRow = {
  storageKey: string;
  groupingKey: string;
  subject: Subject;
  classLevel: 11 | 12;
  topic: string;
  subtopicName: string;
  level: string;
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  submittedAt: string | null;
};

export type BitsSubjectRollupAdmin = {
  subject: Subject;
  quizCount: number;
  total: number;
  correct: number;
  wrong: number;
  skipped: number;
  accuracy: number;
  subtopicTags: string[];
};

const ALLOWED_LEVELS = new Set(["basics", "intermediate", "advanced"]);
const ALLOWED_SUBJECTS = new Set<string>(["physics", "chemistry", "math"]);

function sanitize(value: unknown, maxLen = 300): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\x00-\x1F\x7F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

/**
 * Parse profiles.bits_test_attempts with storage keys for admin audit (retests / ||set:N).
 */
export function parseBitsTestAttemptsKeyed(raw: unknown): BitsAttemptDetailAdminRow[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const out: BitsAttemptDetailAdminRow[] = [];
  for (const [storageKey, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!storageKey.trim()) continue;
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const row = value as Record<string, unknown>;
    const subjectRaw = sanitize(row.subject, 80).toLowerCase();
    if (!ALLOWED_SUBJECTS.has(subjectRaw)) continue;
    const level = sanitize(row.level, 30).toLowerCase();
    if (!ALLOWED_LEVELS.has(level)) continue;
    const topic = sanitize(row.topic, 300);
    const subtopicName = sanitize(row.subtopicName, 300);
    const bitsSignature = sanitize(row.bitsSignature, 200);
    const submittedAt = sanitize(row.submittedAt, 80);
    if (!topic || !subtopicName || !bitsSignature || !submittedAt) continue;

    const clRaw = Number(row.classLevel);
    const classLevel: 11 | 12 = clRaw === 12 ? 12 : 11;

    const totalQuestions = Number(row.totalQuestions);
    const correctCount = Number(row.correctCount);
    const wrongCount = Number(row.wrongCount);
    const tq = Number.isFinite(totalQuestions) ? Math.max(0, Math.trunc(totalQuestions)) : 0;
    const cc = Number.isFinite(correctCount) ? Math.max(0, Math.trunc(correctCount)) : 0;
    const wc = Number.isFinite(wrongCount) ? Math.max(0, Math.trunc(wrongCount)) : 0;
    const skippedCount = Math.max(0, tq - cc - wc);

    out.push({
      storageKey,
      groupingKey: stripBitsAttemptSetSuffix(storageKey),
      subject: subjectRaw as Subject,
      classLevel,
      topic,
      subtopicName,
      level,
      totalQuestions: tq,
      correctCount: cc,
      wrongCount: wc,
      skippedCount,
      submittedAt: submittedAt || null,
    });
  }
  return out;
}

/**
 * Topic quiz rollup by subject: submitted topic-quiz attempts + in-progress engagement drafts
 * (same split as Performance page; excludes play_history arena rows).
 */
export function buildBitsQuizRollupForAdmin(
  bitsKeyed: BitsAttemptDetailAdminRow[],
  drafts: EngagementDraftDashboardRow[]
): {
  attemptCount: number;
  subjectRollup: BitsSubjectRollupAdmin[];
  attemptDetails: BitsAttemptDetailAdminRow[];
} {
  const subjects: Subject[] = ["physics", "chemistry", "math"];
  const subjectRollup: BitsSubjectRollupAdmin[] = [];

  for (const subject of subjects) {
    const bitsRows = bitsKeyed.filter((r) => r.subject === subject);
    const dRows = drafts.filter((r) => r.subject === subject);

    const quizCount = bitsRows.length + dRows.length;

    const bitsCorrect = bitsRows.reduce((s, r) => s + r.correctCount, 0);
    const bitsWrong = bitsRows.reduce((s, r) => s + r.wrongCount, 0);
    const bitsAnswered = bitsCorrect + bitsWrong;
    const bitsSkipped = bitsRows.reduce((s, r) => s + r.skippedCount, 0);

    const dAnswered = dRows.reduce((s, d) => s + d.answered, 0);
    const dCorrect = dRows.reduce((s, d) => s + d.correct, 0);
    const dWrong = dRows.reduce((s, d) => s + d.wrong, 0);
    const dSkipped = dRows.reduce((s, d) => s + d.skipped, 0);

    const total = bitsAnswered + dAnswered;
    const correct = bitsCorrect + dCorrect;
    const wrong = bitsWrong + dWrong;
    const skipped = bitsSkipped + dSkipped;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

    const tagSet = new Set<string>();
    for (const r of bitsRows) {
      if (r.subtopicName.trim()) tagSet.add(r.subtopicName.trim());
    }
    for (const d of dRows) {
      const t = d.topic?.trim();
      if (t) tagSet.add(t);
    }

    subjectRollup.push({
      subject,
      quizCount,
      total,
      correct,
      wrong,
      skipped,
      accuracy,
      subtopicTags: [...tagSet].slice(0, MAX_SUBTOPIC_TAGS_PER_SUBJECT),
    });
  }

  const sortedDetails = [...bitsKeyed].sort((a, b) => {
    const ta = a.submittedAt ? Date.parse(a.submittedAt) : 0;
    const tb = b.submittedAt ? Date.parse(b.submittedAt) : 0;
    return tb - ta;
  });

  return {
    attemptCount: bitsKeyed.length,
    subjectRollup,
    attemptDetails: sortedDetails.slice(0, MAX_BITS_ATTEMPT_DETAILS_ADMIN),
  };
}
