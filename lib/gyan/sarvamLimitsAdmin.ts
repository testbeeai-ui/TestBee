import "server-only";

import { getProfPiDesiredMaxTokens, RAG_CONTEXT_MAX_CHARS } from "@/lib/gyanContentPolicy";
import {
  getSarvamGyanModel,
  getSarvamMaxOutputTokensCap,
  parseSarvamUsageFromPayload,
  resolveSarvamMaxTokens,
  SARVAM_USER_CONTENT_MAX_CHARS,
  SARVAM_SYSTEM_PROMPT_MAX_CHARS,
} from "@/lib/sarvamGyanClient";
import type { SarvamLimitsSnapshot, SarvamProbeResult } from "@/lib/gyan/sarvamLimitsTypes";

const SARVAM_CHAT_URL = "https://api.sarvam.ai/v1/chat/completions";
const PROBE_MAX_TOKENS_CANDIDATES = [1024, 2048, 4096, 8192, 16384] as const;

function ragContextMaxChars(): number {
  const raw = process.env.RAG_FORMATTED_CONTEXT_MAX_CHARS?.trim();
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return RAG_CONTEXT_MAX_CHARS;
}

export function buildSarvamLimitsSnapshot(): SarvamLimitsSnapshot {
  const profPiRequested = getProfPiDesiredMaxTokens();
  return {
    model: getSarvamGyanModel(),
    globalOutputCap: getSarvamMaxOutputTokensCap(),
    profPiRequestedMax: profPiRequested,
    profPiEffectiveMax: resolveSarvamMaxTokens(profPiRequested),
    ragContextMaxChars: ragContextMaxChars(),
    systemPromptMaxChars: SARVAM_SYSTEM_PROMPT_MAX_CHARS,
    userContentMaxChars: SARVAM_USER_CONTENT_MAX_CHARS,
    env: {
      SARVAM_MAX_OUTPUT_TOKENS: process.env.SARVAM_MAX_OUTPUT_TOKENS?.trim() || undefined,
      SARVAM_PROF_PI_MAX_TOKENS: process.env.SARVAM_PROF_PI_MAX_TOKENS?.trim() || undefined,
      SARVAM_GYAN_MODEL: process.env.SARVAM_GYAN_MODEL?.trim() || undefined,
      SARVAM_MODEL: process.env.SARVAM_MODEL?.trim() || undefined,
      RAG_FORMATTED_CONTEXT_MAX_CHARS:
        process.env.RAG_FORMATTED_CONTEXT_MAX_CHARS?.trim() || undefined,
    },
  };
}

/** Probe Sarvam with rising max_tokens (raw API values, not app-clamped). */
export async function probeSarvamMaxTokens(): Promise<SarvamProbeResult> {
  const apiKey = process.env.SARVAM_API_KEY?.trim();
  if (!apiKey) {
    return {
      note: "SARVAM_API_KEY is not set — cannot probe.",
      recommendedMaxTokens: null,
      rows: [],
    };
  }

  const model = getSarvamGyanModel();
  const rows: SarvamProbeResult["rows"] = [];
  let recommendedMaxTokens: number | null = null;

  for (const requested of PROBE_MAX_TOKENS_CANDIDATES) {
    const appResolved = resolveSarvamMaxTokens(requested);
    const started = Date.now();
    let httpStatus: number | null = null;
    let ok = false;
    let error: string | undefined;
    let usage: SarvamProbeResult["rows"][0]["usage"];

    try {
      const response = await fetch(SARVAM_CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        signal: AbortSignal.timeout(25_000),
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: "Reply with exactly: OK" },
            { role: "user", content: "Say OK only." },
          ],
          temperature: 0,
          max_tokens: requested,
        }),
      });
      httpStatus = response.status;
      const bodyText = await response.text();
      if (response.ok) {
        ok = true;
        try {
          const data = JSON.parse(bodyText) as { usage?: unknown };
          usage = parseSarvamUsageFromPayload(data);
        } catch {
          /* ignore parse */
        }
        recommendedMaxTokens = requested;
      } else {
        let detail = bodyText.slice(0, 200);
        try {
          const j = JSON.parse(bodyText) as { error?: { message?: string } };
          if (j?.error?.message) detail = j.error.message;
        } catch {
          /* keep slice */
        }
        error = detail || `HTTP ${response.status}`;
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }

    rows.push({
      requested,
      appResolved,
      httpStatus,
      latencyMs: Date.now() - started,
      ok,
      error,
      usage,
    });

    if (!ok) break;
  }

  const note = recommendedMaxTokens
    ? `Highest successful raw max_tokens for model "${model}": ${recommendedMaxTokens}. Set SARVAM_MAX_OUTPUT_TOKENS ≤ this value (app also clamps Prof-Pi to the global cap).`
    : rows.length === 0
      ? "No probe runs."
      : `All probe attempts failed for model "${model}". Check API key, model id, or Sarvam status.`;

  return { note, recommendedMaxTokens, rows };
}
