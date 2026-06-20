/**
 * Multi-turn Sarvam chat completions (system + history + user).
 * Split from sarvamGyanClient so App Router bundles pick up the export reliably.
 */

import {
  getSarvamGyanModel,
  logSarvamChatMetrics,
  parseSarvamUsageFromPayload,
  resolveSarvamMaxTokens,
  SARVAM_SYSTEM_PROMPT_MAX_CHARS,
  SARVAM_USER_CONTENT_MAX_CHARS,
  type SarvamChatResult,
} from "@/lib/sarvamGyanClient";

const SARVAM_CHAT_URL = "https://api.sarvam.ai/v1/chat/completions";

export type SarvamChatTurn = { role: "user" | "assistant"; content: string };

export async function sarvamChatCompletionThread(params: {
  systemPrompt: string;
  history: SarvamChatTurn[];
  userContent: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  metricsLabel?: string;
}): Promise<SarvamChatResult> {
  const apiKey = process.env.SARVAM_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, error: "SARVAM_API_KEY is not set" };
  }

  const model = getSarvamGyanModel();
  const temperature = params.temperature ?? 0.65;
  const max_tokens = resolveSarvamMaxTokens(params.maxTokens);
  const timeoutMs = params.timeoutMs ?? 55_000;

  const historyMessages = params.history.map((turn) => ({
    role: turn.role,
    content: turn.content.slice(0, 1000),
  }));

  const userChars =
    historyMessages.reduce((acc, m) => acc + m.content.length, 0) +
    params.userContent.length;

  try {
    const response = await fetch(SARVAM_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: params.systemPrompt.slice(0, SARVAM_SYSTEM_PROMPT_MAX_CHARS),
          },
          ...historyMessages,
          {
            role: "user",
            content: params.userContent.slice(0, SARVAM_USER_CONTENT_MAX_CHARS),
          },
        ],
        temperature,
        max_tokens,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      let detail = errBody.slice(0, 800);
      try {
        const j = JSON.parse(errBody) as { error?: { message?: string; code?: string } };
        if (j?.error?.message) detail = j.error.message;
      } catch {
        /* keep slice */
      }
      console.error("[sarvamChatThread] HTTP", response.status, detail);
      return { ok: false, error: `Sarvam HTTP ${response.status}${detail ? `: ${detail}` : ""}` };
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: unknown;
    };
    const raw = data.choices?.[0]?.message?.content ?? "";
    if (!raw.trim()) {
      return { ok: false, error: "Empty Sarvam response" };
    }
    const usage = parseSarvamUsageFromPayload(data);
    logSarvamChatMetrics({
      label: params.metricsLabel,
      model,
      systemChars: params.systemPrompt.length,
      userChars,
      usage,
    });
    return { ok: true, text: raw, usage };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[sarvamChatThread]", msg);
    return { ok: false, error: msg };
  }
}
