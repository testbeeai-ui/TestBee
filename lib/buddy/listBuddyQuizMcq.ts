import { buddyMcqPaperHref } from "@/lib/buddy/buddyMcqPaperHref";
import { buildTopicPath } from "@/lib/curriculum/topicRoutes";
import type { DifficultyLevel, Subject } from "@/types";
import type { Json } from "@/integrations/supabase/types";

export type BuddyMcqRecentRow = {
  id: string;
  source: "topic_quiz" | "mock";
  paperName: string;
  scorePercent: number | null;
  correct: number | null;
  total: number | null;
  takenAt: string;
  href: string;
};

type TopicQuizRecord = {
  board: string;
  subject: string;
  classLevel: 11 | 12;
  topic: string;
  subtopicName: string;
  level: DifficultyLevel;
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  submittedAt: string;
  setLabel: string | null;
};

const ALLOWED_LEVELS = new Set(["basics", "intermediate", "advanced"]);
const ALLOWED_SUBJECTS = new Set(["physics", "chemistry", "math"]);

function sanitize(value: unknown, maxLen = 300): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\x00-\x1F\x7F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

function parseSetLabelFromKey(key: string): string | null {
  const m = key.match(/\|\|set:(\d)$/i);
  if (!m) return null;
  return `Set ${m[1]}`;
}

function parseTopicQuizStore(raw: unknown): TopicQuizRecord[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const out: TopicQuizRecord[] = [];
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const row = value as Record<string, unknown>;
    const subject = sanitize(row.subject, 80).toLowerCase();
    const level = sanitize(row.level, 30).toLowerCase();
    if (!ALLOWED_SUBJECTS.has(subject) || !ALLOWED_LEVELS.has(level)) continue;
    const topic = sanitize(row.topic, 300);
    const subtopicName = sanitize(row.subtopicName, 300);
    const bitsSignature = sanitize(row.bitsSignature, 200);
    const submittedAt = sanitize(row.submittedAt, 80);
    if (!topic || !subtopicName || !bitsSignature || !submittedAt) continue;
    const tq = Number(row.totalQuestions);
    const cc = Number(row.correctCount);
    const wc = Number(row.wrongCount);
    out.push({
      board: sanitize(row.board, 40) || "cbse",
      subject,
      classLevel: Number(row.classLevel) === 12 ? 12 : 11,
      topic,
      subtopicName,
      level: level as DifficultyLevel,
      totalQuestions: Number.isFinite(tq) ? Math.max(0, Math.trunc(tq)) : 0,
      correctCount: Number.isFinite(cc) ? Math.max(0, Math.trunc(cc)) : 0,
      wrongCount: Number.isFinite(wc) ? Math.max(0, Math.trunc(wc)) : 0,
      submittedAt,
      setLabel: parseSetLabelFromKey(key),
    });
  }
  return out;
}

export function listBuddyTopicQuizAttempts(
  bitsAttemptsJson: Json | null | undefined,
  limit = 5
): BuddyMcqRecentRow[] {
  const rows = parseTopicQuizStore(bitsAttemptsJson);
  return rows
    .map((row, idx) => {
      const total = row.totalQuestions;
      const correct = row.correctCount;
      const scorePercent = total > 0 ? Math.round((correct / total) * 1000) / 10 : null;
      const subj = row.subject as Subject;
      const href = buildTopicPath(
        row.board,
        subj,
        row.classLevel,
        row.topic,
        row.subtopicName,
        row.level
      );
      const setSuffix = row.setLabel ? ` (${row.setLabel})` : "";
      const paperName = `Topic quiz · ${row.subtopicName}${setSuffix}`;
      return {
        id: `topic-quiz:${idx}:${row.submittedAt}`,
        source: "topic_quiz" as const,
        paperName,
        scorePercent,
        correct,
        total,
        takenAt: row.submittedAt,
        href,
      };
    })
    .sort((a, b) => Date.parse(b.takenAt) - Date.parse(a.takenAt))
    .slice(0, limit);
}

export function latestBuddyTopicQuizAttempt(
  bitsAttemptsJson: Json | null | undefined
): TopicQuizRecord | null {
  const rows = parseTopicQuizStore(bitsAttemptsJson);
  if (rows.length === 0) return null;
  return rows.sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt))[0] ?? null;
}

type MockAttemptRow = {
  paper_id: string;
  score_percent: number | null;
  correct_count: number | null;
  total_questions: number | null;
  created_at: string;
  mock_papers?:
    | {
        slug?: string;
        title?: string;
        paper_type?: string | null;
        chapter_id?: string | null;
      }
    | Array<{
        slug?: string;
        title?: string;
        paper_type?: string | null;
        chapter_id?: string | null;
      }>
    | null;
};

export function listBuddyMcqRecentMerged(
  mockRows: MockAttemptRow[],
  bitsAttemptsJson: Json | null | undefined,
  limit = 5
): BuddyMcqRecentRow[] {
  const mockItems: BuddyMcqRecentRow[] = mockRows.map((row) => {
    const paperRaw = row.mock_papers;
    const paper = Array.isArray(paperRaw) ? (paperRaw[0] ?? null) : (paperRaw ?? null);
    return {
      id: `mock:${row.paper_id}:${row.created_at}`,
      source: "mock",
      paperName: paper?.title ?? "Mock paper",
      scorePercent: row.score_percent == null ? null : Number(row.score_percent),
      correct: row.correct_count,
      total: row.total_questions,
      takenAt: row.created_at,
      href: buddyMcqPaperHref(paper),
    };
  });

  const topicItems = listBuddyTopicQuizAttempts(bitsAttemptsJson, limit);
  return [...topicItems, ...mockItems]
    .sort((a, b) => Date.parse(b.takenAt) - Date.parse(a.takenAt))
    .slice(0, limit);
}
