import { supabase } from "@/integrations/supabase/client";
import type { Subject } from "@/types";
import type { CreateTestQuestionBankMatch } from "@/lib/play/quiz/createTestBankTypes";
import type { TeacherTestRowsResponse } from "@/lib/teacherPortal/generatedTest";

export async function fetchTeacherTestBankRows(params: {
  subject: Subject;
  classLevel: 11 | 12;
  match: CreateTestQuestionBankMatch;
}): Promise<{ data: TeacherTestRowsResponse | null; error: string | null }> {
  const { subject, classLevel, match } = params;
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch("/api/teacher/test-bank-rows", {
    method: "POST",
    headers,
    credentials: "same-origin",
    body: JSON.stringify({ subject, classLevel, match }),
  });

  const payload = (await res.json().catch(() => ({}))) as
    | TeacherTestRowsResponse
    | { error?: string | null };

  if (!res.ok) {
    const errField = (payload as { error?: string | null }).error;
    const msg = typeof errField === "string" ? errField : `Rows request failed (${res.status})`;
    return { data: null, error: msg };
  }

  return { data: payload as TeacherTestRowsResponse, error: null };
}
