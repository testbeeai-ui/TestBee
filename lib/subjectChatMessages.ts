import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type SubjectChatScope = {
  subject: string;
  topic: string;
  subtopic?: string;
  gradeLevel?: number;
  /** URL segments — separate threads that share the same topic label on different routes. */
  board?: string;
  unitSlug?: string;
  topicSlug?: string;
  levelSlug?: string;
  sectionSlug?: string;
  /** Taxonomy labels (e.g. explore) when there is no URL slug. */
  unitLabel?: string;
  chapterTitle?: string;
};

export type ChatMessageRow = { role: "user" | "assistant"; content: string };

const MAX_CONTENT_CHARS = 8000;
const DEFAULT_THREAD_LIMIT = 40;

function normalizeScopePart(value: string | number | undefined): string {
  if (value == null) return "na";
  return encodeURIComponent(String(value).trim().toLowerCase());
}

/**
 * Stable thread key: subject + grade + topic + subtopic, plus optional route/taxonomy
 * segments so different chapters or URLs never share a row when labels collide.
 */
export function buildSubjectChatContextKey(scope: SubjectChatScope): string {
  const parts = [
    "subject",
    normalizeScopePart(scope.subject),
    "grade",
    normalizeScopePart(scope.gradeLevel ?? 11),
    "topic",
    normalizeScopePart(scope.topic),
    "subtopic",
    normalizeScopePart(scope.subtopic ?? ""),
  ];
  const append = (label: string, value: string | undefined) => {
    if (value == null) return;
    const t = String(value).trim();
    if (!t) return;
    parts.push(label, normalizeScopePart(t));
  };
  append("board", scope.board);
  append("unit", scope.unitSlug);
  append("topicSlug", scope.topicSlug);
  append("level", scope.levelSlug);
  append("section", scope.sectionSlug);
  append("unitLabel", scope.unitLabel);
  append("chapterTitle", scope.chapterTitle);
  return parts.join(":");
}

function clampContent(text: string): string {
  const t = text.trim();
  if (t.length <= MAX_CONTENT_CHARS) return t;
  return t.slice(0, MAX_CONTENT_CHARS);
}

/** Load recent messages oldest-first for Sarvam `messages` (excluding the turn about to be sent). */
export async function loadThreadMessages(
  supabase: SupabaseClient<Database>,
  params: { userId: string; contextKey: string; limit?: number }
): Promise<ChatMessageRow[]> {
  const limit = params.limit ?? DEFAULT_THREAD_LIMIT;
  const { data, error } = await supabase
    .from("subject_topic_chat_messages")
    .select("role, content, created_at")
    .eq("user_id", params.userId)
    .eq("context_key", params.contextKey)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[subjectChatMessages] loadThreadMessages", error.message);
    return [];
  }

  const rows: ChatMessageRow[] = [];
  for (const r of data ?? []) {
    if (
      (r.role === "user" || r.role === "assistant") &&
      typeof r.content === "string"
    ) {
      rows.push({ role: r.role, content: r.content });
    }
  }

  return rows.reverse();
}

export async function appendUserAndAssistantMessages(
  supabase: SupabaseClient<Database>,
  params: {
    userId: string;
    contextKey: string;
    userText: string;
    assistantText: string;
  }
): Promise<{ ok: boolean; error?: string }> {
  const userContent = clampContent(params.userText);
  const assistantContent = clampContent(params.assistantText);
  if (!userContent || !assistantContent) {
    return { ok: false, error: "empty_content" };
  }

  const { error: e1 } = await supabase.from("subject_topic_chat_messages").insert({
    user_id: params.userId,
    context_key: params.contextKey,
    role: "user",
    content: userContent,
  });
  if (e1) {
    console.error("[subjectChatMessages] insert user", e1.message);
    return { ok: false, error: e1.message };
  }

  const { error: e2 } = await supabase.from("subject_topic_chat_messages").insert({
    user_id: params.userId,
    context_key: params.contextKey,
    role: "assistant",
    content: assistantContent,
  });
  if (e2) {
    console.error("[subjectChatMessages] insert assistant", e2.message);
    return { ok: false, error: e2.message };
  }

  return { ok: true };
}

/** Build Sarvam history from client when user is not authenticated. */
export function normalizeAnonClientHistory(
  history: { role?: unknown; content?: unknown }[] | undefined,
  maxTurns: number
): ChatMessageRow[] {
  if (!Array.isArray(history)) return [];
  return history
    .slice(-maxTurns)
    .map((item): ChatMessageRow | null => {
      const role =
        item?.role === "assistant" || item?.role === "bot" ? "assistant" : "user";
      const content =
        typeof item?.content === "string" ? item.content.trim().slice(0, 1000) : "";
      if (!content.length) return null;
      return { role, content };
    })
    .filter((item): item is ChatMessageRow => item !== null);
}

/** `api/chat` route: one thread per user for the generic assistant. */
export function buildApiChatContextKey(userId: string): string {
  return `api_chat:user:${userId}`;
}
