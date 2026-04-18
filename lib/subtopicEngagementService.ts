import { supabase } from "@/integrations/supabase/client";
import type { DifficultyLevel } from "@/lib/slugs";
import type { Board, Subject } from "@/types";
import { safeGetSession } from "@/lib/safeSession";

const API = "/api/user/subtopic-engagement";

export type SubtopicEngagementScope = {
  board: Board;
  subject: Subject;
  classLevel: 11 | 12;
  topic: string;
  subtopicName: string;
  level: DifficultyLevel;
};

/** Server/client: scored counts for answered questions only (in-progress quiz before Submit). */
export type SubtopicEngagementBitsGraded = {
  answered: number;
  correct: number;
  wrong: number;
  totalQuestions: number;
};

export type SubtopicEngagementBitsDraft = {
  currentIdx: number;
  selectedAnswers: Record<string, number>;
  visitedIndices: number[];
  graded?: SubtopicEngagementBitsGraded;
  /** Advanced 3-set flow: which set the in-progress state refers to (indices are global). */
  activeQuizSet?: 1 | 2 | 3;
};

export type SubtopicEngagementFormulaDraft = {
  qIdx: number;
  answers: Record<string, number>;
};

export type SubtopicEngagementSnapshot = {
  v: 1;
  bitsSignature: string;
  updatedAt: string;
  bits?: SubtopicEngagementBitsDraft | null;
  formulaByIdx?: Record<string, SubtopicEngagementFormulaDraft>;
  instaCue?: {
    navVisited: number[];
    flipped: number[];
  } | null;
  conceptsPages?: number[];
  /** ISO timestamp when user marked Lessons/Progress checklist complete for this subtopic. */
  lessonChecklistMarkedCompleteAt?: string;
  /**
   * Lessons/Progress item 1 (10 min focus): persisted so refresh keeps countdown.
   * Reset when the learner hides the tab or switches subtopic/level (see topic page).
   */
  lessonFocusTimer?: {
    secondsRemaining: number;
    running: boolean;
  } | null;
};

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

export async function fetchSubtopicEngagement(scope: SubtopicEngagementScope): Promise<SubtopicEngagementSnapshot | null> {
  const headers = await getAuthHeaders();
  const search = new URLSearchParams({
    board: scope.board,
    subject: scope.subject,
    classLevel: String(scope.classLevel),
    topic: scope.topic,
    subtopicName: scope.subtopicName,
    level: scope.level,
  });
  const res = await fetch(`${API}?${search.toString()}`, { headers });
  if (!res.ok) {
    if (res.status === 401) return null;
    throw new Error("Failed to fetch subtopic engagement");
  }
  const data = (await res.json()) as { engagement?: SubtopicEngagementSnapshot | null };
  return data.engagement ?? null;
}

export async function saveSubtopicEngagement(
  scope: SubtopicEngagementScope,
  snapshot: SubtopicEngagementSnapshot
): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(API, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ ...scope, snapshot }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || "Failed to save subtopic engagement");
  }
}
