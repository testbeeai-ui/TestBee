/**
 * Sarvam chat completions for Gyan++ bot flows (student doubt sim + ProfPi).
 * Server-only; uses SARVAM_API_KEY.
 *
 * Related env: `SARVAM_MAX_OUTPUT_TOKENS` (plan cap), `SARVAM_PROF_PI_MAX_TOKENS` (Prof-Pi completion; see gyanContentPolicy).
 * Metrics: set `GYAN_LOG_SARVAM_USAGE=1` or `DEBUG_GYAN_PROMPT_SIZES=1` to log `[sarvamMetrics]` lines with char sizes and
 * provider `usage` (prompt_tokens / completion_tokens / total_tokens) when the API returns them.
 */

const SARVAM_CHAT_URL = "https://api.sarvam.ai/v1/chat/completions";

const SARVAM_OUTPUT_TOKENS_MIN = 64;
/** Hard ceiling so misconfigured env cannot blow past provider limits */
const SARVAM_OUTPUT_TOKENS_ABS_MAX = 32_768;

export function getSarvamGyanModel(): string {
  return process.env.SARVAM_GYAN_MODEL?.trim() || process.env.SARVAM_MODEL?.trim() || "sarvam-m";
}

/**
 * Max completion tokens allowed for this deployment.
 * Sarvam starter + `sarvam-m` commonly caps at **2048**; higher tiers need a higher cap here.
 * Set `SARVAM_MAX_OUTPUT_TOKENS` (integer) in production when your plan allows more.
 */
export function getSarvamMaxOutputTokensCap(): number {
  const raw = process.env.SARVAM_MAX_OUTPUT_TOKENS?.trim();
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n >= SARVAM_OUTPUT_TOKENS_MIN) {
      return Math.min(n, SARVAM_OUTPUT_TOKENS_ABS_MAX);
    }
  }
  return 2048;
}

/** Clamp caller request to [min, cap] where cap comes from env (default starter-safe). */
export function resolveSarvamMaxTokens(requested?: number): number {
  const cap = getSarvamMaxOutputTokensCap();
  const r =
    requested == null || !Number.isFinite(requested)
      ? cap
      : Math.floor(requested);
  return Math.min(Math.max(r, SARVAM_OUTPUT_TOKENS_MIN), cap);
}

export function stripSarvamThinking(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/(?:redacted_thinking|think)>\s*/gi, "")
    .trim();
}

export function normalizeLatexForGyan(text: string): string {
  let s = text;
  s = s.replace(/\\\[[\s\S]*?\\\]/g, (m) => `$$${m.slice(2, -2).trim()}$$`);
  s = s.replace(/\\\((?:[^\n]|\n(?!\n))*?\\\)/g, (m) => `$${m.slice(2, -2).trim()}$`);
  return s;
}

export function normalizeTextWrappedFormulaTokensForGyan(text: string): string {
  let s = text;
  for (let i = 0; i < 3; i++) {
    s = s.replace(/\\text\{([^{}]+)\}/g, (_m, inner: string) => {
      const v = inner.trim();
      if (!v) return _m;
      if (/\s{2,}/.test(v)) return _m;
      if (/[A-Za-z]/.test(v) && /[_^0-9+\-=()[\]{}\\/]/.test(v) && !/\s/.test(v)) {
        return v;
      }
      return _m;
    });
  }
  return s;
}

export function formatSarvamAssistantReply(raw: string): string {
  let t = stripSarvamThinking(raw);
  t = normalizeLatexForGyan(t);
  t = normalizeTextWrappedFormulaTokensForGyan(t);
  return t.trim();
}

/** OpenAI-compatible usage block from Sarvam `v1/chat/completions` (field names may vary by version). */
export type SarvamUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

export type SarvamChatResult =
  | { ok: true; text: string; usage?: SarvamUsage }
  | { ok: false; error: string };

export function parseSarvamUsageFromPayload(data: unknown): SarvamUsage | undefined {
  if (!data || typeof data !== "object") return undefined;
  const usage = (data as { usage?: unknown }).usage;
  if (!usage || typeof usage !== "object") return undefined;
  const u = usage as Record<string, unknown>;
  const num = (k: string): number | undefined => {
    const v = u[k];
    if (typeof v !== "number" || !Number.isFinite(v)) return undefined;
    return v;
  };
  const prompt_tokens = num("prompt_tokens");
  const completion_tokens = num("completion_tokens");
  const total_tokens = num("total_tokens");
  if (prompt_tokens == null && completion_tokens == null && total_tokens == null) return undefined;
  return { prompt_tokens, completion_tokens, total_tokens };
}

function shouldLogSarvamMetrics(): boolean {
  return process.env.GYAN_LOG_SARVAM_USAGE === "1" || process.env.DEBUG_GYAN_PROMPT_SIZES === "1";
}

/**
 * One structured line after a successful `chat/completions` parse (also usable from custom fetch paths).
 */
export function logSarvamChatMetrics(params: {
  label?: string;
  model: string;
  systemChars?: number;
  userChars?: number;
  usage?: SarvamUsage | undefined;
}): void {
  if (!shouldLogSarvamMetrics()) return;
  const label = params.label ? ` ${params.label}` : "";
  const chars =
    params.systemChars != null || params.userChars != null
      ? ` sysChars=${params.systemChars ?? "?"} userChars=${params.userChars ?? "?"}`
      : "";
  const u = params.usage;
  const tok =
    u && (u.prompt_tokens != null || u.completion_tokens != null || u.total_tokens != null)
      ? ` prompt_tokens=${u.prompt_tokens ?? "?"} completion_tokens=${u.completion_tokens ?? "?"} total_tokens=${u.total_tokens ?? "?"}`
      : " usage_missing";
  console.info(`[sarvamMetrics]${label} model=${params.model}${chars}${tok}`);
}

/**
 * Single-turn Sarvam chat completion (system + user).
 */
export async function sarvamChatCompletion(params: {
  systemPrompt: string;
  userContent: string;
  temperature?: number;
  /** Desired max completion tokens; clamped to `getSarvamMaxOutputTokensCap()` (default 2048). */
  maxTokens?: number;
  timeoutMs?: number;
  /** Included in `[sarvamMetrics]` when metrics logging is enabled */
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
          // Hard caps after upstream truncation (Gyan policy + RAG) — avoids accidental token bombs
          { role: "system", content: params.systemPrompt.slice(0, 8000) },
          { role: "user", content: params.userContent.slice(0, 6000) },
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
      console.error("[sarvamGyanClient] HTTP", response.status, detail);
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
      userChars: params.userContent.length,
      usage,
    });
    return { ok: true, text: raw, usage };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[sarvamGyanClient]", msg);
    return { ok: false, error: msg };
  }
}

/** Strip ``` / ```json fences (first fenced block wins). */
function stripMarkdownCodeFences(s: string): string {
  const m = /```(?:json)?\s*([\s\S]*?)```/i.exec(s);
  if (m?.[1]) return m[1].trim();
  return s
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
}

/** First top-level `{ ... }` using brace depth (ignores `{` / `}` inside JSON strings). */
function sliceFirstBalancedJsonObject(s: string): string | null {
  const start = s.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i]!;
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (c === "\\") {
        escape = true;
        continue;
      }
      if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

/** Remove trailing commas before `}` or `]` (common LLM mistake; safe on typical flat JSON). */
function removeTrailingCommasInJson(json: string): string {
  return json.replace(/,(\s*[}\]])/g, "$1");
}

function tryParseJsonRecord(slice: string): Record<string, unknown> | null {
  const variants = [slice, removeTrailingCommasInJson(slice)];
  const unicodeFixed = variants.map((v) =>
    v.replace(/\u201c|\u201d/g, '"').replace(/\uFEFF/g, ""),
  );
  for (const t of unicodeFixed) {
    try {
      const v = JSON.parse(t) as unknown;
      if (v !== null && typeof v === "object" && !Array.isArray(v)) {
        return v as Record<string, unknown>;
      }
    } catch {
      /* next */
    }
  }
  return null;
}

/**
 * Extract first JSON object from model output: thinking strip, markdown fences,
 * brace-balanced slice (fixes extra prose / wrong lastIndexOf when `}` appears in strings),
 * trailing-comma + smart-quote tolerance.
 */
export function extractJsonObject(raw: string): Record<string, unknown> | null {
  let s = stripSarvamThinking(raw.trim().replace(/^\uFEFF/, ""));
  s = stripMarkdownCodeFences(s);

  const balanced = sliceFirstBalancedJsonObject(s);
  if (balanced) {
    const rec = tryParseJsonRecord(balanced);
    if (rec) return rec;
  }

  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const rec = tryParseJsonRecord(s.slice(start, end + 1));
    if (rec) return rec;
  }
  return null;
}
