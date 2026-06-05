export type SubjectChatQuotaResponse = {
  plan: string;
  dailyLimit: number | null;
  unlimited: boolean;
  usedToday: number;
  remaining: number | null;
  multilingual: boolean;
  canSend: boolean;
  istDate: string;
};

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
