import { supabase } from "@/integrations/supabase/client";

interface SaveTestHistoryParams {
  board: string;
  classLevel: 11 | 12;
  subject: "physics" | "chemistry" | "math";
  scope: "Topic-wise" | "Unit-wise" | "Chapter-wise" | "Full paper";
  chapterTitle?: string | null;
  topicTitle?: string | null;
  unitTitle?: string | null;
  questions: unknown[];
  questionCount: number;
  durationMinutes?: number | null;
  usedQuestionStems: string[];
}

export async function saveTestHistory(
  params: SaveTestHistoryParams
): Promise<{ id: string | null; error: string | null }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const res = await fetch("/api/teacher/save-test-history", {
    method: "POST",
    headers,
    credentials: "same-origin",
    body: JSON.stringify(params),
  });

  const payload = (await res.json().catch(() => ({}))) as { id?: string; error?: string };

  if (!res.ok) {
    return {
      id: null,
      error: typeof payload.error === "string" ? payload.error : `Save failed (${res.status})`,
    };
  }

  return {
    id: typeof payload.id === "string" ? payload.id : null,
    error: null,
  };
}
