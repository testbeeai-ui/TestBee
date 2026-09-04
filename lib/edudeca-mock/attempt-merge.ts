import { isMockPaperLevel } from "./paper-filter";

export type MockAttemptStatus = "inprogress" | "completed";

export type MockAttemptSnapshot = {
  level: 1 | 2 | 3;
  setNumber: number;
  status: MockAttemptStatus;
  scorePct?: number;
  correct?: number;
  total?: number;
  answers?: unknown;
};

export function snapshotFromAttemptRow(row: Record<string, unknown> | null): MockAttemptSnapshot | null {
  if (!row) return null;
  const level = Number(row.level);
  const setNumber = Number(row.set_number);
  const status = row.status;
  if (!isMockPaperLevel(level) || !Number.isInteger(setNumber)) return null;
  if (status !== "completed" && status !== "inprogress") return null;
  return {
    level,
    setNumber,
    status,
    scorePct: typeof row.score_pct === "number" ? row.score_pct : undefined,
    correct: typeof row.correct === "number" ? row.correct : undefined,
    total: typeof row.total === "number" ? row.total : undefined,
    answers: row.answers,
  };
}

function answerMap(raw: unknown): Record<string, string> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "string" && value !== "") out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function betterScore(current: number | undefined, incoming: number | undefined): number | undefined {
  if (current == null) return incoming;
  if (incoming == null) return current;
  return Math.max(current, incoming);
}

export function mergeMockAttempt(
  existing: MockAttemptSnapshot | null,
  incoming: MockAttemptSnapshot,
): MockAttemptSnapshot {
  if (!existing) return { ...incoming };

  if (existing.status === "completed" && incoming.status === "inprogress") {
    return { ...existing };
  }

  const status: MockAttemptStatus =
    existing.status === "completed" || incoming.status === "completed" ? "completed" : "inprogress";

  const keepExistingScore =
    status === "completed" &&
    existing.status === "completed" &&
    (existing.scorePct ?? -1) >= (incoming.scorePct ?? -1);

  return {
    level: incoming.level,
    setNumber: incoming.setNumber,
    status,
    scorePct: betterScore(existing.scorePct, incoming.scorePct),
    correct: keepExistingScore ? existing.correct : (incoming.correct ?? existing.correct),
    total: keepExistingScore ? existing.total : (incoming.total ?? existing.total),
    answers: keepExistingScore
      ? existing.answers
      : (answerMap(incoming.answers) ?? answerMap(existing.answers) ?? incoming.answers),
  };
}
