import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";
import {
  getMemoryContext,
  appendRecentTurn,
  type MemoryTurn,
  buildMemoryScopeKey,
  type MemoryScope,
} from "@/lib/memory";
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
const MAX_HISTORY_TURNS = 6;
const MODAL_WEBHOOK_TIMEOUT_MS = 1500;

function normalizeUserMessage(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_USER_MESSAGE_CHARS);
}

function normalizeHistory(
  history: ChatRequestBody["history"]
): { role: "user" | "assistant"; content: string }[] {
  if (!Array.isArray(history)) return [];

  return history
    .slice(-MAX_HISTORY_TURNS)
    .map((item): { role: "user" | "assistant"; content: string } | null => {
      const role: "user" | "assistant" =
        item?.role === "assistant" || item?.role === "bot" ? "assistant" : "user";
      const content =
        typeof item?.content === "string" ? item.content.trim().slice(0, 1000) : "";
      if (!content.length) return null;
      return { role, content };
    })
    .filter((item): item is { role: "user" | "assistant"; content: string } => item !== null);
}

function sanitizeField(value: unknown, maxLen: number): string {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, maxLen);
}

function normalizeScope(body: ChatRequestBody): MemoryScope {
  const subject = sanitizeField(body.subject, 40) || "physics";
  const topic = sanitizeField(body.topic, 200) || "general";
  const subtopic = sanitizeField(body.subtopic, 200) || undefined;
  const gradeRaw = Number(body.gradeLevel);
  const gradeLevel = Number.isFinite(gradeRaw) ? Math.max(1, Math.min(12, gradeRaw)) : 11;
  return { subject, topic, subtopic, gradeLevel };
}

function buildSystemPrompt(memoryPromptContext: string): string {
  return `You are a helpful educational assistant.
Use memory context as non-authoritative personalization context.
If memory conflicts with the user's latest message, trust the latest message.

MEMORY CONTEXT:
${memoryPromptContext}`;
}

function mapHistoryForModal(
  history: { role: "user" | "assistant"; content: string }[]
): MemoryTurn[] {
  return history.map((h) => ({ role: h.role, content: h.content }));
}

async function dispatchModalMemoryWebhook(payload: {
  userId: string;
  contextKey: string;
  chatHistory: MemoryTurn[];
  newTurn: { user: string; assistant: string };
}): Promise<void> {
  const webhookUrl = process.env.MEMORY_MODAL_WEBHOOK_URL?.trim();
  if (!webhookUrl) return;

  const authToken = process.env.MEMORY_WEBHOOK_AUTH_TOKEN?.trim();

  // Keep this short and bounded so request latency is not dominated by webhook delivery.
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(MODAL_WEBHOOK_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`Modal webhook failed: ${res.status}`);
  }
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

    const history = normalizeHistory(body.history);
    const scope = normalizeScope(body);
    const contextKey = buildMemoryScopeKey(scope);

    const memory = await getMemoryContext(auth.user.id, userMessage, scope);
    const systemPrompt = buildSystemPrompt(memory.promptContext);

    const historyText =
      history.length > 0
        ? history.map((h) => `${h.role.toUpperCase()}: ${h.content}`).join("\n")
        : "No prior turns.";
    const userPrompt = `Conversation history:
${historyText}

Latest user message:
${userMessage}`;

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

    await Promise.all([
      appendRecentTurn(auth.user.id, {
        role: "user",
        content: userMessage,
      }, contextKey),
      appendRecentTurn(auth.user.id, {
        role: "assistant",
        content: reply,
      }, contextKey),
    ]);

    try {
      await dispatchModalMemoryWebhook({
        userId: auth.user.id,
        contextKey,
        chatHistory: mapHistoryForModal(history),
        newTurn: { user: userMessage, assistant: reply },
      });
    } catch (error) {
      console.warn("[api/chat] memory webhook dispatch failed:", error);
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
        historyTurns: history.length,
        hasMemoryContext: Boolean(memory.promptContext),
        episodicMatches: memory.episodicMatches.length,
      },
    });

    return NextResponse.json({
      reply,
      memory: {
        recentTurns: memory.recentTurns.length,
        episodicMatches: memory.episodicMatches.length,
      },
    });
  } catch (error) {
    console.error("[api/chat] error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
