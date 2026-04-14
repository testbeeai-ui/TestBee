import { supabase } from "@/integrations/supabase/client";
import type { DifficultyLevel } from "@/lib/slugs";
import type { Board, Subject } from "@/types";

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
};

async function getAuthHeaders(): Promise<HeadersInit> {
  const headers: Record<string, string> = {};
  if (typeof window !== "undefined") {
    const {
      data: { session },
    } = await supabase.auth.getSession();
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
