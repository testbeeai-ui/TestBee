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
    answers: keepExistingScore ? existing.answers : (incoming.answers ?? existing.answers),
  };
}
