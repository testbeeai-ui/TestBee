import { supabase } from "@/integrations/supabase/client";
import type { DifficultyLevel } from "@/lib/slugs";
import type { Board, Subject } from "@/types";
import { safeGetSession } from "@/lib/auth/safeSession";
import { localStudyCalendarDay } from "@/lib/dashboard/studyDayBump";
import { dispatchStudyDayBumped } from "@/lib/dashboard/studyDayBumpEvents";

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
  /** Required for advanced (1–3); omitted for basics/intermediate. */
  set?: 1 | 2 | 3;
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
  const search = new URLSearchParams({
    board: scope.board,
    subject: scope.subject,
    classLevel: String(scope.classLevel),
    topic: scope.topic,
    subtopicName: scope.subtopicName,
    level: scope.level,
  });
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

export async function saveBitsAttempt(
  attempt: BitsAttemptRecord,
  options?: { set?: 1 | 2 | 3 }
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
  return data.attempt ?? attempt;
}

export async function fetchFormulaPracticeAttempt(
  scope: FormulaPracticeAttemptScope,
  formulaPracticeIndex: number
): Promise<BitsAttemptRecord | null> {
  const headers = await getAuthHeaders();
  const search = new URLSearchParams({
    board: scope.board,
    subject: scope.subject,
    classLevel: String(scope.classLevel),
    topic: scope.topic,
    subtopicName: scope.subtopicName,
    level: scope.level,
    formulaPracticeIndex: String(formulaPracticeIndex),
  });
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
  scope: BitsAttemptScope & { set: 1 | 2 | 3 }
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
