import type { Subject } from "@/types";

/** One row from profiles.bits_test_attempts (same shape as API route). */
export type ParsedBitsAttemptRow = {
  subject: Subject;
  /** PUC / board class (from attempt JSON; defaults to 11 when missing for legacy rows). */
  classLevel: 11 | 12;
  /** Chapter / unit title from stored attempt (for dashboards). */
  topic: string;
  /** Subtopic title from stored attempt (matches curriculum subtopic names). */
  subtopicName: string;
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  /** Parsed submittedAt for activity heatmap (ms since epoch). */
  submittedAtMs?: number;
};

const ALLOWED_LEVELS = new Set(["basics", "intermediate", "advanced"]);
const ALLOWED_SUBJECTS = new Set<string>(["physics", "chemistry", "math", "biology"]);

function sanitize(value: unknown, maxLen = 300): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\x00-\x1F\x7F]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLen);
}

/**
 * Parse profiles.bits_test_attempts JSONB into rows for dashboards.
 * Matches server validation in app/api/user/bits-attempts/route.ts (retake = same key, latest wins).
 */
export function parseBitsTestAttemptsStore(raw: unknown): ParsedBitsAttemptRow[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const out: ParsedBitsAttemptRow[] = [];
  for (const value of Object.values(raw as Record<string, unknown>)) {
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

    const submittedAtMs = Date.parse(submittedAt);

    out.push({
      subject: subjectRaw as Subject,
      classLevel,
      topic,
      subtopicName,
      totalQuestions: tq,
      correctCount: cc,
      wrongCount: wc,
      submittedAtMs: Number.isFinite(submittedAtMs) ? submittedAtMs : undefined,
    });
  }
  return out;
}
