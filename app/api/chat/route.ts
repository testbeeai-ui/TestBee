import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";
import {
  appendUserAndAssistantMessages,
  buildApiChatContextKey,
  loadThreadMessages,
} from "@/lib/subjectChatMessages";
import {
  sarvamChatCompletion,
  formatSarvamAssistantReply,
  getSarvamGyanModel,
} from "@/lib/sarvamGyanClient";
import { logAiUsage } from "@/lib/aiLogger";

type ChatRequestBody = {
  message?: unknown;
  history?: { role?: unknown; content?: unknown }[];
  subject?: unknown;
  topic?: unknown;
  subtopic?: unknown;
  gradeLevel?: unknown;
};

const MAX_USER_MESSAGE_CHARS = 2000;

function normalizeUserMessage(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_USER_MESSAGE_CHARS);
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getSupabaseAndUser(req);
    if (!auth?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as ChatRequestBody;
    const userMessage = normalizeUserMessage(body.message);
    if (!userMessage) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    const contextKey = buildApiChatContextKey(auth.user.id);
    const fromDb = await loadThreadMessages(auth.supabase, {
      userId: auth.user.id,
      contextKey,
      limit: 40,
    });

    const historyText =
      fromDb.length > 0
        ? fromDb
            .slice(-20)
            .map((h) => `${h.role.toUpperCase()}: ${h.content}`)
            .join("\n")
        : "No prior turns.";
    const userPrompt = `Conversation history:
${historyText}

Latest user message:
${userMessage}`;

    const systemPrompt = `You are a helpful educational assistant. Be concise and accurate.`;

    const llm = await sarvamChatCompletion({
      systemPrompt,
      userContent: userPrompt,
      temperature: 0.4,
      maxTokens: 1024,
      timeoutMs: 30_000,
      metricsLabel: "api_chat",
    });

    if (!llm.ok) {
      return NextResponse.json(
        { error: "AI service unavailable", detail: llm.error },
        { status: 502 }
      );
    }

    const reply = formatSarvamAssistantReply(llm.text);

    const persist = await appendUserAndAssistantMessages(auth.supabase, {
      userId: auth.user.id,
      contextKey,
      userText: userMessage,
      assistantText: reply,
    });
    if (!persist.ok) {
      console.warn("[api/chat] failed to persist chat messages:", persist.error);
    }

    await logAiUsage({
      supabase: auth.supabase,
      userId: auth.user.id,
      actionType: "chat_sarvam",
      modelId: getSarvamGyanModel(),
      backend: "sarvam",
      usage: llm.usage
        ? {
            promptTokenCount: llm.usage.prompt_tokens,
            candidatesTokenCount: llm.usage.completion_tokens,
            totalTokenCount: llm.usage.total_tokens,
          }
        : undefined,
      metadata: {
        source: "api_chat_route",
        contextKey,
        dbHistoryTurns: fromDb.length,
      },
    });

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("[api/chat] error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
