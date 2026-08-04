import type { DifficultyLevel } from "@/lib/slugs";
import type { Board, Subject } from "@/types";
import { safeGetSession } from "@/lib/auth/safeSession";
import { localStudyCalendarDay } from "@/lib/dashboard/studyDayBump";
import { track } from "@/lib/analytics/track";
import type { AdvancedQuizSetIndex } from "@/lib/play/quiz/advancedQuizSets";

const API = "/api/user/bits-attempts";

export type BitsAttemptRecord = {
  board: Board;
  subject: Subject;
  classLevel: 11 | 12;
  topic: string;
  subtopicName: string;
  level: DifficultyLevel;
  bitsSignature: string;
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  selectedAnswers: Record<string, number>;
  submittedAt: string;
};

type BitsAttemptScope = {
  board: Board;
  subject: Subject;
  classLevel: 11 | 12;
  topic: string;
  subtopicName: string;
  level: DifficultyLevel;
  /** Required for advanced (1–6); omitted for basics/intermediate. */
  set?: AdvancedQuizSetIndex;
};

/** Scope for Numerals / formula-practice attempts (never uses advanced `set`). */
export type FormulaPracticeAttemptScope = Omit<BitsAttemptScope, "set">;

async function getAuthHeaders(): Promise<HeadersInit> {
  const headers: Record<string, string> = {};
  if (typeof window !== "undefined") {
    const { session } = await safeGetSession();
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }
  }
  return headers;
}

export async function fetchBitsAttempt(scope: BitsAttemptScope): Promise<BitsAttemptRecord | null> {
  const headers = await getAuthHeaders();
  const search = scopeSearchParams(scope);
  if (scope.level === "advanced") {
    search.set("set", String(scope.set ?? 1));
  }
  const res = await fetch(`${API}?${search.toString()}`, { headers });
  if (!res.ok) {
    if (res.status === 401) return null;
    throw new Error("Failed to fetch quiz attempt");
  }
  const data = (await res.json()) as { attempt?: BitsAttemptRecord | null };
  return data.attempt ?? null;
}

function scopeSearchParams(scope: Omit<BitsAttemptScope, "set">): URLSearchParams {
  return new URLSearchParams({
    board: scope.board,
    subject: scope.subject,
    classLevel: String(scope.classLevel),
    topic: scope.topic,
    subtopicName: scope.subtopicName,
    level: scope.level,
  });
}

/**
 * Hydrates several advanced sets in one request.
 *
 * Fetching sets individually cost one round trip each, which is the dominant
 * page-load stall on a slow connection.
 */
export async function fetchBitsAttemptsBySet(
  scope: Omit<BitsAttemptScope, "set">,
  sets: readonly AdvancedQuizSetIndex[]
): Promise<Partial<Record<AdvancedQuizSetIndex, BitsAttemptRecord | null>>> {
  if (sets.length === 0) return {};
  const headers = await getAuthHeaders();
  const search = scopeSearchParams(scope);
  search.set("sets", sets.join(","));

  const res = await fetch(`${API}?${search.toString()}`, { headers });
  if (!res.ok) {
    if (res.status === 401) return {};
    throw new Error("Failed to fetch quiz attempts");
  }
  const data = (await res.json()) as {
    attempts?: Record<string, BitsAttemptRecord | null> | null;
  };

  const out: Partial<Record<AdvancedQuizSetIndex, BitsAttemptRecord | null>> = {};
  for (const set of sets) {
    out[set] = data.attempts?.[String(set)] ?? null;
  }
  return out;
}

/** Stays under the route's per-request index cap; subtopics rarely exceed one chunk. */
const FORMULA_BATCH_SIZE = 50;

/** Hydrates several numerals cards in one request; keyed by formula index. */
export async function fetchFormulaPracticeAttempts(
  scope: FormulaPracticeAttemptScope,
  formulaPracticeIndices: readonly number[]
): Promise<Record<number, BitsAttemptRecord | null>> {
  if (formulaPracticeIndices.length === 0) return {};
  const headers = await getAuthHeaders();

  const chunks: number[][] = [];
  for (let i = 0; i < formulaPracticeIndices.length; i += FORMULA_BATCH_SIZE) {
    chunks.push(formulaPracticeIndices.slice(i, i + FORMULA_BATCH_SIZE));
  }

  const out: Record<number, BitsAttemptRecord | null> = {};
  const results = await Promise.all(
    chunks.map(async (indices) => {
      const search = scopeSearchParams(scope);
      search.set("formulaPracticeIndices", indices.join(","));
      const res = await fetch(`${API}?${search.toString()}`, { headers });
      if (!res.ok) {
        if (res.status === 401) return null;
        throw new Error("Failed to fetch formula practice attempts");
      }
      const data = (await res.json()) as {
        formulaAttempts?: Record<string, BitsAttemptRecord | null> | null;
      };
      return data.formulaAttempts ?? {};
    })
  );

  for (let i = 0; i < chunks.length; i += 1) {
    const attempts = results[i];
    if (!attempts) continue;
    for (const fi of chunks[i]) {
      out[fi] = attempts[String(fi)] ?? null;
    }
  }
  return out;
}

export async function saveBitsAttempt(
  attempt: BitsAttemptRecord,
  options?: { set?: AdvancedQuizSetIndex }
): Promise<BitsAttemptRecord> {
  const authHeaders = await getAuthHeaders();
  const body =
    attempt.level === "advanced" && options?.set != null
      ? { ...attempt, set: options.set, studyDay: localStudyCalendarDay() }
      : { ...attempt, studyDay: localStudyCalendarDay() };
  const res = await fetch(API, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { attempt?: BitsAttemptRecord; error?: string };
  if (!res.ok) {
    throw new Error(data.error || "Failed to save quiz attempt");
  }
  const { notifyBuddyActivityRefresh } = await import("@/lib/buddy/buddyActivityEvents");
  notifyBuddyActivityRefresh();
  track("bits_quiz_submitted", {
    board: attempt.board,
    subject: attempt.subject,
    classLevel: attempt.classLevel,
    topic: attempt.topic,
    subtopic: attempt.subtopicName,
    level: attempt.level,
    totalQuestions: attempt.totalQuestions,
    correctCount: attempt.correctCount,
    wrongCount: attempt.wrongCount,
  });
  return data.attempt ?? attempt;
}

export async function fetchFormulaPracticeAttempt(
  scope: FormulaPracticeAttemptScope,
  formulaPracticeIndex: number
): Promise<BitsAttemptRecord | null> {
  const headers = await getAuthHeaders();
  const search = scopeSearchParams(scope);
  search.set("formulaPracticeIndex", String(formulaPracticeIndex));
  const res = await fetch(`${API}?${search.toString()}`, { headers });
  if (!res.ok) {
    if (res.status === 401) return null;
    throw new Error("Failed to fetch formula practice attempt");
  }
  const data = (await res.json()) as { attempt?: BitsAttemptRecord | null };
  return data.attempt ?? null;
}

export async function saveFormulaPracticeAttempt(
  attempt: BitsAttemptRecord,
  formulaPracticeIndex: number
): Promise<BitsAttemptRecord> {
  const authHeaders = await getAuthHeaders();
  const body = {
    ...attempt,
    formulaPracticeIndex,
    studyDay: localStudyCalendarDay(),
  };
  const res = await fetch(API, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { attempt?: BitsAttemptRecord; error?: string };
  if (!res.ok) {
    throw new Error(data.error || "Failed to save formula practice attempt");
  }
  return data.attempt ?? attempt;
}

export async function clearFormulaPracticeAttempt(
  scope: FormulaPracticeAttemptScope,
  formulaPracticeIndex: number
): Promise<void> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch(API, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({
      board: scope.board,
      subject: scope.subject,
      classLevel: scope.classLevel,
      topic: scope.topic,
      subtopicName: scope.subtopicName,
      level: scope.level,
      clearFormulaAttempt: true,
      formulaPracticeIndex,
    }),
  });
  const data = (await res.json()) as { ok?: boolean; error?: string };
  if (!res.ok) {
    throw new Error(data.error || "Failed to clear formula practice attempt");
  }
}

export async function clearBitsAttemptSet(
  scope: BitsAttemptScope & { set: AdvancedQuizSetIndex }
): Promise<void> {
  if (scope.level !== "advanced") return;
  const authHeaders = await getAuthHeaders();
  const res = await fetch(API, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({
      board: scope.board,
      subject: scope.subject,
      classLevel: scope.classLevel,
      topic: scope.topic,
      subtopicName: scope.subtopicName,
      level: scope.level,
      clearAttempt: true,
      set: scope.set,
    }),
  });
  const data = (await res.json()) as { ok?: boolean; error?: string };
  if (!res.ok) {
    throw new Error(data.error || "Failed to clear quiz attempt");
  }
}
