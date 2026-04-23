import { supabase } from "@/integrations/supabase/client";

export interface TestHistoryItem {
  id: string;
  teacher_id: string;
  board: string;
  class_level: number;
  subject: string;
  scope: "Topic-wise" | "Unit-wise";
  chapter_title: string | null;
  topic_title: string | null;
  unit_title: string | null;
  questions: unknown[];
  question_count: number;
  duration_minutes: number | null;
  generated_at: string;
  used_question_ids: string[];
}

interface FetchTestHistoryParams {
  subject?: string;
  topicTitle?: string;
  limit?: number;
}

export async function fetchTestHistory(
  params: FetchTestHistoryParams = {}
): Promise<{ history: TestHistoryItem[]; error: string | null }> {
  const { subject, topicTitle, limit = 50 } = params;

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const queryParams = new URLSearchParams();
  if (subject) queryParams.set("subject", subject);
  if (topicTitle) queryParams.set("topicTitle", topicTitle);
  if (limit) queryParams.set("limit", String(limit));

  const res = await fetch(`/api/teacher/test-history?${queryParams.toString()}`, {
    method: "GET",
    headers,
    credentials: "same-origin",
  });

  const payload = (await res.json().catch(() => ({}))) as {
    history?: TestHistoryItem[];
    error?: string;
  };

  if (!res.ok) {
    return {
      history: [],
      error: typeof payload.error === "string" ? payload.error : `Fetch failed (${res.status})`,
    };
  }

  return {
    history: Array.isArray(payload.history) ? payload.history : [],
    error: null,
  };
}
