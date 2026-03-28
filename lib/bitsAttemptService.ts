import { supabase } from "@/integrations/supabase/client";
import type { DifficultyLevel } from "@/lib/slugs";
import type { Board, Subject } from "@/types";

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
};

async function getAuthHeaders(): Promise<HeadersInit> {
  const headers: Record<string, string> = {};
  if (typeof window !== "undefined") {
    const { data: { session } } = await supabase.auth.getSession();
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
  const res = await fetch(`${API}?${search.toString()}`, { headers });
  if (!res.ok) {
    if (res.status === 401) return null;
    throw new Error("Failed to fetch Bits attempt");
  }
  const data = (await res.json()) as { attempt?: BitsAttemptRecord | null };
  return data.attempt ?? null;
}

export async function saveBitsAttempt(attempt: BitsAttemptRecord): Promise<BitsAttemptRecord> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch(API, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify(attempt),
  });
  const data = (await res.json()) as { attempt?: BitsAttemptRecord; error?: string };
  if (!res.ok) {
    throw new Error(data.error || "Failed to save Bits attempt");
  }
  return data.attempt ?? attempt;
}
