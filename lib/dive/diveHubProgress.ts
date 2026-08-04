/**
 * Dive hub progress: sessionStorage cache + optional DB sync.
 * - Instant local reads/writes for UI
 * - 1 GET hydrate per subtopic open (when signed in)
 * - Debounced PUT for completed + undertaking (scores via /api/dive/assessment only)
 */

import { fetchWithClientAuth } from "@/lib/auth/clientApiAuth";
import { makeSubtopicEngagementStorageKey } from "@/lib/curriculum/subtopicEngagementStorageKey";
import type { DiveActivityId } from "@/components/dive/diveTypes";
import { DIVE_ACTIVITY_IDS } from "@/components/dive/diveTypes";
import type { DiveAssessmentKind } from "@/lib/dive/gradeDiveAssessment";
import { scorePctFromAnswers as gradeScorePct } from "@/lib/dive/gradeDiveAssessment";
import type { Board, Subject } from "@/types";

const STORAGE_PREFIX = "edublast:dive-hub-progress:v2:";
const API = "/api/dive/progress";
const ASSESSMENT_API = "/api/dive/assessment";
const SAVE_DEBOUNCE_MS = 700;

export type DiveHubProgress = {
  completed: DiveActivityId[];
  quizScore: number | null;
  numeralScore: number | null;
  outcomesScore: number | null;
  undertakingAccepted: boolean;
};

export type DiveHubProgressScope = {
  board: Board;
  subject: Subject;
  classLevel: 11 | 12;
  topic: string;
  subtopicName: string;
  level?: "basics" | "intermediate" | "advanced";
};

const ACTIVITY_SET = new Set<string>(DIVE_ACTIVITY_IDS);

function storageKey(subtopicId: string): string {
  return `${STORAGE_PREFIX}${subtopicId}`;
}

function clampScore(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return Math.max(0, Math.min(100, Math.round(v)));
}

function parseCompleted(raw: unknown): DiveActivityId[] {
  if (!Array.isArray(raw)) return [];
  const out: DiveActivityId[] = [];
  const seen = new Set<string>();
  for (const id of raw) {
    if (typeof id !== "string" || !ACTIVITY_SET.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id as DiveActivityId);
  }
  return out;
}

export function emptyDiveHubProgress(): DiveHubProgress {
  return {
    completed: [],
    quizScore: null,
    numeralScore: null,
    outcomesScore: null,
    undertakingAccepted: false,
  };
}

export function normalizeDiveHubProgress(
  raw: Partial<DiveHubProgress> | null | undefined
): DiveHubProgress {
  if (!raw) return emptyDiveHubProgress();
  return {
    completed: parseCompleted(raw.completed),
    quizScore: clampScore(raw.quizScore),
    numeralScore: clampScore(raw.numeralScore),
    outcomesScore: clampScore(raw.outcomesScore),
    undertakingAccepted: raw.undertakingAccepted === true,
  };
}

export function diveHubProgressEqual(a: DiveHubProgress, b: DiveHubProgress): boolean {
  if (a.quizScore !== b.quizScore) return false;
  if (a.numeralScore !== b.numeralScore) return false;
  if (a.outcomesScore !== b.outcomesScore) return false;
  if (a.undertakingAccepted !== b.undertakingAccepted) return false;
  if (a.completed.length !== b.completed.length) return false;
  const setB = new Set(b.completed);
  return a.completed.every((id) => setB.has(id));
}

/** Prefer higher scores + union of completed + undertaking OR. */
export function mergeDiveHubProgress(a: DiveHubProgress, b: DiveHubProgress): DiveHubProgress {
  const completed = Array.from(new Set([...a.completed, ...b.completed]));
  const maxScore = (x: number | null, y: number | null): number | null => {
    if (x == null) return y;
    if (y == null) return x;
    return Math.max(x, y);
  };
  return {
    completed,
    quizScore: maxScore(a.quizScore, b.quizScore),
    numeralScore: maxScore(a.numeralScore, b.numeralScore),
    outcomesScore: maxScore(a.outcomesScore, b.outcomesScore),
    undertakingAccepted: a.undertakingAccepted || b.undertakingAccepted,
  };
}

export function loadDiveHubProgress(subtopicId: string): DiveHubProgress {
  if (typeof window === "undefined" || !subtopicId) return emptyDiveHubProgress();
  try {
    const raw =
      sessionStorage.getItem(storageKey(subtopicId)) ??
      sessionStorage.getItem(`edublast:dive-hub-progress:v1:${subtopicId}`);
    if (!raw) return emptyDiveHubProgress();
    return normalizeDiveHubProgress(JSON.parse(raw) as Partial<DiveHubProgress>);
  } catch {
    return emptyDiveHubProgress();
  }
}

export function saveDiveHubProgress(subtopicId: string, progress: DiveHubProgress): void {
  if (typeof window === "undefined" || !subtopicId) return;
  try {
    sessionStorage.setItem(storageKey(subtopicId), JSON.stringify(normalizeDiveHubProgress(progress)));
  } catch {
    /* ignore quota / private mode */
  }
}

/** Local optimistic grade (UI); authoritative score comes from submitDiveAssessment. */
export function scorePctFromAnswers(
  questions: Array<{ correctAnswer: string }>,
  answers: Record<number, string>
): { correct: number; total: number; scorePct: number } {
  return gradeScorePct(questions, answers);
}

const inflightGet = new Map<string, Promise<DiveHubProgress | null>>();
const pendingSaveTimers = new Map<string, ReturnType<typeof setTimeout>>();
const lastSavedFingerprint = new Map<string, string>();

function scopeFingerprint(scope: DiveHubProgressScope, progress: DiveHubProgress): string {
  const key = makeSubtopicEngagementStorageKey({
    ...scope,
    level: scope.level ?? "advanced",
  });
  return `${key}::${JSON.stringify(normalizeDiveHubProgress(progress))}`;
}

/** One GET per scope; concurrent callers share the same promise. */
export async function fetchDiveHubProgressFromDb(
  scope: DiveHubProgressScope
): Promise<DiveHubProgress | null> {
  const level = scope.level ?? "advanced";
  const cacheKey = makeSubtopicEngagementStorageKey({ ...scope, level });
  const existing = inflightGet.get(cacheKey);
  if (existing) return existing;

  const promise = (async () => {
    const search = new URLSearchParams({
      board: scope.board,
      subject: scope.subject,
      classLevel: String(scope.classLevel),
      topic: scope.topic,
      subtopicName: scope.subtopicName,
      level,
    });
    const res = await fetchWithClientAuth(`${API}?${search.toString()}`, {
      method: "GET",
      cache: "no-store",
    });
    if (res.status === 401) return null;
    if (!res.ok) throw new Error("Failed to fetch dive progress");
    const data = (await res.json()) as { progress?: Partial<DiveHubProgress> | null };
    const progress = normalizeDiveHubProgress(data.progress ?? null);
    lastSavedFingerprint.set(cacheKey, scopeFingerprint({ ...scope, level }, progress));
    return progress;
  })().finally(() => {
    inflightGet.delete(cacheKey);
  });

  inflightGet.set(cacheKey, promise);
  return promise;
}

async function putDiveHubProgressNow(
  scope: DiveHubProgressScope,
  progress: DiveHubProgress
): Promise<void> {
  const level = scope.level ?? "advanced";
  const cacheKey = makeSubtopicEngagementStorageKey({ ...scope, level });
  const fp = scopeFingerprint({ ...scope, level }, progress);
  if (lastSavedFingerprint.get(cacheKey) === fp) return;

  const res = await fetchWithClientAuth(API, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      board: scope.board,
      subject: scope.subject,
      classLevel: scope.classLevel,
      topic: scope.topic,
      subtopicName: scope.subtopicName,
      level,
      completed: progress.completed,
      undertakingAccepted: progress.undertakingAccepted,
    }),
  });
  if (res.status === 401) return;
  if (res.status === 204) {
    lastSavedFingerprint.set(cacheKey, fp);
    return;
  }
  if (!res.ok) throw new Error("Failed to save dive progress");
  const data = (await res.json()) as { progress?: Partial<DiveHubProgress> };
  if (data.progress) {
    const server = normalizeDiveHubProgress(data.progress);
    lastSavedFingerprint.set(cacheKey, scopeFingerprint({ ...scope, level }, server));
  } else {
    lastSavedFingerprint.set(cacheKey, fp);
  }
}

/** Debounced DB save — completed + undertaking only (scores via assessment API). */
export function scheduleDiveHubProgressSave(
  scope: DiveHubProgressScope,
  progress: DiveHubProgress
): void {
  const level = scope.level ?? "advanced";
  const cacheKey = makeSubtopicEngagementStorageKey({ ...scope, level });
  const fp = scopeFingerprint({ ...scope, level }, progress);
  if (lastSavedFingerprint.get(cacheKey) === fp) return;

  const prev = pendingSaveTimers.get(cacheKey);
  if (prev) clearTimeout(prev);

  const timer = setTimeout(() => {
    pendingSaveTimers.delete(cacheKey);
    void putDiveHubProgressNow({ ...scope, level }, progress).catch(() => {
      /* offline / transient — session cache still holds progress */
    });
  }, SAVE_DEBOUNCE_MS);
  pendingSaveTimers.set(cacheKey, timer);
}

/** Flush pending save immediately (e.g. before leaving hub). */
export function flushDiveHubProgressSave(
  scope: DiveHubProgressScope,
  progress: DiveHubProgress
): void {
  const level = scope.level ?? "advanced";
  const cacheKey = makeSubtopicEngagementStorageKey({ ...scope, level });
  const prev = pendingSaveTimers.get(cacheKey);
  if (prev) {
    clearTimeout(prev);
    pendingSaveTimers.delete(cacheKey);
  }
  void putDiveHubProgressNow({ ...scope, level }, progress).catch(() => {});
}

export type DiveAssessmentSubmitInput = {
  scope: DiveHubProgressScope;
  kind: DiveAssessmentKind;
  answers: Record<number, string>;
  quizSetIndex?: number;
  formulaIndex?: number;
};

export type DiveAssessmentSubmitResult = {
  correct: number;
  total: number;
  scorePct: number;
  progress: DiveHubProgress;
};

/** Server-grades answers and upserts the verified score into dive_hub_progress. */
export async function submitDiveAssessment(
  input: DiveAssessmentSubmitInput
): Promise<DiveAssessmentSubmitResult | null> {
  const level = input.scope.level ?? "advanced";
  const res = await fetchWithClientAuth(ASSESSMENT_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      board: input.scope.board,
      subject: input.scope.subject,
      classLevel: input.scope.classLevel,
      topic: input.scope.topic,
      subtopicName: input.scope.subtopicName,
      level,
      kind: input.kind,
      answers: input.answers,
      quizSetIndex: input.quizSetIndex,
      formulaIndex: input.formulaIndex,
    }),
  });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error("Failed to submit dive assessment");
  const data = (await res.json()) as {
    correct?: number;
    total?: number;
    scorePct?: number;
    progress?: Partial<DiveHubProgress>;
  };
  const progress = normalizeDiveHubProgress(data.progress ?? null);
  const cacheKey = makeSubtopicEngagementStorageKey({ ...input.scope, level });
  lastSavedFingerprint.set(cacheKey, scopeFingerprint({ ...input.scope, level }, progress));
  return {
    correct: typeof data.correct === "number" ? data.correct : 0,
    total: typeof data.total === "number" ? data.total : 0,
    scorePct: typeof data.scorePct === "number" ? data.scorePct : 0,
    progress,
  };
}
