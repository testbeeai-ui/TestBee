import { supabase } from "@/integrations/supabase/client";
import type { Subject } from "@/types";
import type { CreateTestQuestionBankMatch } from "@/lib/createTestBankTypes";

export type { CreateTestQuestionBankMatch } from "@/lib/createTestBankTypes";

/**
 * Server-side count (paginates real rows; avoids fragile PostgREST `.or()` filters).
 * Sends the browser Supabase access token so the API sees the same session as the PKCE client
 * (localStorage session is not always mirrored to HTTP-only cookies).
 */
export async function countQuestionBankForCreateTest(params: {
  subject: Subject;
  classLevel: 11 | 12;
  match: CreateTestQuestionBankMatch;
}): Promise<{ count: number; rawCount?: number; usedCount?: number; error: string | null }> {
  const { subject, classLevel, match } = params;
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const res = await fetch("/api/teacher/create-test-bank-count", {
    method: "POST",
    headers,
    credentials: "same-origin",
    body: JSON.stringify({ classLevel, subject, match }),
  });

  const payload = (await res.json().catch(() => ({}))) as {
    count?: number;
    rawCount?: number;
    usedCount?: number;
    error?: string | null;
  };

  if (!res.ok) {
    return {
      count: 0,
      error:
        typeof payload.error === "string" && payload.error
          ? payload.error
          : `Count request failed (${res.status})`,
    };
  }

  return {
    count: typeof payload.count === "number" ? payload.count : 0,
    rawCount: typeof payload.rawCount === "number" ? payload.rawCount : undefined,
    usedCount: typeof payload.usedCount === "number" ? payload.usedCount : undefined,
    error: typeof payload.error === "string" ? payload.error : null,
  };
}
