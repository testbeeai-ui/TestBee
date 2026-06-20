import type { SubjectChatRegionalCode } from "@/lib/subscription/subjectChatRegionalLanguage";

export type SubjectChatQuotaResponse = {
  plan: string;
  dailyLimit: number | null;
  unlimited: boolean;
  usedToday: number;
  remaining: number | null;
  multilingual: boolean;
  regionalLanguage: SubjectChatRegionalCode | null;
  needsRegionalLanguageSelection: boolean;
  canSend: boolean;
  istDate: string;
};

export type SaveSubjectChatRegionalLanguageResult =
  | { ok: true; regionalLanguage: SubjectChatRegionalCode; locked: true }
  | { ok: false; code: string; error: string };

export type ResetSubjectChatRegionalLanguageResult =
  | {
      ok: true;
      regionalLanguage: SubjectChatRegionalCode | null;
      needsRegionalLanguageSelection: boolean;
      multilingual: boolean;
    }
  | { ok: false; code: string; error: string };

export async function fetchSubjectChatQuota(
  accessToken?: string | null
): Promise<SubjectChatQuotaResponse | null> {
  if (!accessToken) return null;
  try {
    const res = await fetch("/api/user/subject-chat-quota", {
      credentials: "include",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    return (await res.json()) as SubjectChatQuotaResponse;
  } catch {
    return null;
  }
}

export async function saveSubjectChatRegionalLanguage(
  accessToken: string,
  language: SubjectChatRegionalCode
): Promise<SaveSubjectChatRegionalLanguageResult> {
  try {
    const res = await fetch("/api/user/subject-chat-regional-language", {
      method: "POST",
      credentials: "include",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ language }),
    });
    const data = (await res.json()) as {
      regionalLanguage?: SubjectChatRegionalCode;
      locked?: boolean;
      code?: string;
      error?: string;
    };
    if (!res.ok) {
      return {
        ok: false,
        code: data.code ?? "SAVE_FAILED",
        error: data.error ?? "Could not save your language.",
      };
    }
    if (!data.regionalLanguage) {
      return {
        ok: false,
        code: "SAVE_FAILED",
        error: "Could not save your language.",
      };
    }
    return {
      ok: true,
      regionalLanguage: data.regionalLanguage,
      locked: true,
    };
  } catch {
    return {
      ok: false,
      code: "NETWORK_ERROR",
      error: "Connection issue. Please try again.",
    };
  }
}

/** Admin QA only — clears immutable regional language lock on own profile. */
export async function resetSubjectChatRegionalLanguage(
  accessToken: string
): Promise<ResetSubjectChatRegionalLanguageResult> {
  try {
    const res = await fetch("/api/admin/subject-chat-regional-language-reset", {
      method: "POST",
      credentials: "include",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = (await res.json()) as {
      regionalLanguage?: SubjectChatRegionalCode | null;
      needsRegionalLanguageSelection?: boolean;
      multilingual?: boolean;
      code?: string;
      error?: string;
    };
    if (!res.ok) {
      return {
        ok: false,
        code: data.code ?? "RESET_FAILED",
        error: data.error ?? "Could not reset language lock.",
      };
    }
    return {
      ok: true,
      regionalLanguage: data.regionalLanguage ?? null,
      needsRegionalLanguageSelection: data.needsRegionalLanguageSelection ?? false,
      multilingual: data.multilingual ?? false,
    };
  } catch {
    return {
      ok: false,
      code: "NETWORK_ERROR",
      error: "Connection issue. Please try again.",
    };
  }
}
