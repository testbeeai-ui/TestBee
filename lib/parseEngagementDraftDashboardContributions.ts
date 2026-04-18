import type { Subject } from "@/types";

const ALLOWED_SUBJECTS = new Set<string>(["physics", "chemistry", "math", "biology"]);

export type EngagementDraftDashboardRow = {
  subject: Subject;
  /** Topic/chapter segment from engagement storage key (index 3). */
  topic: string | null;
  answered: number;
  correct: number;
  wrong: number;
  skipped: number;
};

function clampInt(n: unknown, max = 1_000_000): number {
  if (!Number.isFinite(Number(n))) return 0;
  return Math.max(0, Math.min(max, Math.trunc(Number(n))));
}

function subjectFromEngagementKey(key: string): Subject | null {
  const parts = key.split("||");
  if (parts.length < 2) return null;
  const subj = parts[1]?.trim().toLowerCase();
  if (!subj || !ALLOWED_SUBJECTS.has(subj)) return null;
  return subj as Subject;
}

function topicFromEngagementKey(key: string): string | null {
  const parts = key.split("||");
  if (parts.length < 4) return null;
  const t = parts[3]?.trim();
  return t ? t : null;
}

/**
 * In-progress topic quiz rows from profiles.subtopic_engagement for home stats.
 * Skips keys that already have a submitted row in bits_test_attempts (same key shape).
 */
export function parseEngagementDraftDashboardContributions(
  raw: unknown,
  submittedAttemptKeys: Set<string>,
): EngagementDraftDashboardRow[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const out: EngagementDraftDashboardRow[] = [];
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (submittedAttemptKeys.has(key)) continue;
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const row = value as Record<string, unknown>;
    if (Number(row.v) !== 1) continue;
    const subject = subjectFromEngagementKey(key);
    if (!subject) continue;
    const topic = topicFromEngagementKey(key);
    if (row.bits === null || row.bits === undefined) continue;
    if (typeof row.bits !== "object" || Array.isArray(row.bits)) continue;
    const b = row.bits as Record<string, unknown>;
    const g = b.graded;
    if (!g || typeof g !== "object" || Array.isArray(g)) continue;
    const gr = g as Record<string, unknown>;
    const answered = clampInt(gr.answered);
    const correct = clampInt(gr.correct);
    const wrong = clampInt(gr.wrong);
    const totalQuestions = clampInt(gr.totalQuestions);
    if (answered <= 0 && correct <= 0 && wrong <= 0) continue;
    const skipped = totalQuestions > 0 ? Math.max(0, totalQuestions - answered) : 0;
    out.push({ subject, topic, answered, correct, wrong, skipped });
  }
  return out;
}
