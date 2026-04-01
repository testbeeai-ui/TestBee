import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";

export type AiUsageMetadata = Record<string, Json | undefined>;

export type GeminiUsageStats = {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
};

export type PriceConfig = {
  inputPer1M: number;
  outputPer1M: number;
};

/**
 * USD per 1M tokens — estimated billing (not a GCP invoice).
 * Override via env so you can align with current Google AI / Vertex pricing without code changes.
 *
 * Env keys (all optional; fallbacks match previous hardcoded defaults):
 * - AI_COST_GEMINI_31_PRO_INPUT_PER_1M / AI_COST_GEMINI_31_PRO_OUTPUT_PER_1M
 * - AI_COST_GEMINI_FLASH_INPUT_PER_1M / AI_COST_GEMINI_FLASH_OUTPUT_PER_1M  (Flash / Flash-Lite family)
 * - AI_COST_GEMINI_PRO_INPUT_PER_1M / AI_COST_GEMINI_PRO_OUTPUT_PER_1M      (2.5 Pro, 3.x Pro non-3.1)
 * - AI_COST_DEFAULT_INPUT_PER_1M / AI_COST_DEFAULT_OUTPUT_PER_1M           (unmatched model ids)
 */
function parseEnvUsdPer1M(key: string, fallback: number): number {
  const raw = process.env[key]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function priceGemini31Pro(): PriceConfig {
  return {
    inputPer1M: parseEnvUsdPer1M("AI_COST_GEMINI_31_PRO_INPUT_PER_1M", 3.5),
    outputPer1M: parseEnvUsdPer1M("AI_COST_GEMINI_31_PRO_OUTPUT_PER_1M", 10.5),
  };
}

function priceGeminiFlash(): PriceConfig {
  return {
    inputPer1M: parseEnvUsdPer1M("AI_COST_GEMINI_FLASH_INPUT_PER_1M", 0.35),
    outputPer1M: parseEnvUsdPer1M("AI_COST_GEMINI_FLASH_OUTPUT_PER_1M", 1.05),
  };
}

function priceGeminiPro(): PriceConfig {
  return {
    inputPer1M: parseEnvUsdPer1M("AI_COST_GEMINI_PRO_INPUT_PER_1M", 1.25),
    outputPer1M: parseEnvUsdPer1M("AI_COST_GEMINI_PRO_OUTPUT_PER_1M", 5.0),
  };
}

function priceDefault(): PriceConfig {
  return {
    inputPer1M: parseEnvUsdPer1M("AI_COST_DEFAULT_INPUT_PER_1M", 1.25),
    outputPer1M: parseEnvUsdPer1M("AI_COST_DEFAULT_OUTPUT_PER_1M", 5.0),
  };
}

const MODEL_PRICING_USD_PER_1M: Array<{ match: RegExp; price: () => PriceConfig }> = [
  { match: /gemini-3\.1-pro/i, price: priceGemini31Pro },
  { match: /gemini-3.*flash|gemini-2\.5-flash|gemini-1\.5-flash/i, price: priceGeminiFlash },
  { match: /gemini-2\.5-pro|gemini-3.*pro/i, price: priceGeminiPro },
];

function normalizeTokenCount(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return 0;
  return Math.max(0, Math.round(v));
}

function resolvePriceConfig(modelId: string): PriceConfig {
  const normalized = modelId.trim();
  if (!normalized) return priceDefault();
  for (const row of MODEL_PRICING_USD_PER_1M) {
    if (row.match.test(normalized)) return row.price();
  }
  return priceDefault();
}

export function getGeminiPricingUsdPer1M(modelId: string): PriceConfig {
  return resolvePriceConfig(modelId);
}

export function estimateGeminiCostUsd(
  modelId: string,
  promptTokens: number,
  candidatesTokens: number
): number {
  const pricing = resolvePriceConfig(modelId);
  const inputCost = (promptTokens / 1_000_000) * pricing.inputPer1M;
  const outputCost = (candidatesTokens / 1_000_000) * pricing.outputPer1M;
  return Number((inputCost + outputCost).toFixed(8));
}

export async function logAiUsage(params: {
  supabase: SupabaseClient<Database>;
  userId?: string | null;
  actionType: string;
  modelId: string;
  backend: "api_key" | "vertex";
  usage?: GeminiUsageStats;
  metadata?: AiUsageMetadata;
}): Promise<void> {
  const promptTokens = normalizeTokenCount(params.usage?.promptTokenCount);
  const candidatesTokens = normalizeTokenCount(params.usage?.candidatesTokenCount);
  const providedTotal = normalizeTokenCount(params.usage?.totalTokenCount);
  const totalTokens = providedTotal || promptTokens + candidatesTokens;
  const costUsd = estimateGeminiCostUsd(params.modelId, promptTokens, candidatesTokens);

  const { error } = await params.supabase.from("ai_token_logs").insert({
    user_id: params.userId ?? null,
    action_type: params.actionType,
    model_id: params.modelId,
    backend: params.backend,
    prompt_tokens: promptTokens,
    candidates_tokens: candidatesTokens,
    total_tokens: totalTokens,
    cost_usd: costUsd,
    metadata: (params.metadata ?? {}) as Json,
  });

  if (error) {
    console.error("[aiLogger] failed to insert ai_token_logs", error);
  }
}
