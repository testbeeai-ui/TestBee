/**
 * Resolves GEMINI_MODEL env to an id that exists on the Google GenAI v1beta API.
 * Aliases cover common misconfigurations (e.g. marketing name vs API id).
 */
const MODEL_ALIASES: Record<string, string> = {
  // v1beta uses *-preview* for Gemini 3.1 Pro public preview (not "gemini-3.1-pro" alone).
  "gemini-3.1-pro": "gemini-3.1-pro-preview",
  "gemini-3-pro": "gemini-3-pro-preview",
};

export function resolveGeminiModelId(raw: string | undefined): {
  modelId: string;
  /** Set when env was rewritten via alias */
  aliasFrom?: string;
} {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return { modelId: "gemini-2.5-pro" };
  }
  const key = trimmed.toLowerCase();
  const mapped = MODEL_ALIASES[key];
  if (mapped) {
    return { modelId: mapped, aliasFrom: trimmed };
  }
  return { modelId: trimmed };
}

/** IDs that commonly work on AI Studio but return 404 on Vertex (wrong publisher / region). */
const VERTEX_TYPICAL_404_IDS = new Set([
  "gemini-3.1-pro-preview",
  "gemini-3-pro-preview",
]);

/**
 * Vertex uses a different model catalog than AI Studio (`generativelanguage`).
 * If `GEMINI_MODEL` points at a preview id that only exists on AI Studio, Vertex returns 404.
 *
 * - Set `VERTEX_GEMINI_MODEL` to force a Vertex id (recommended for production).
 * - If unset and the resolved `GEMINI_MODEL` is a known AI-Studio-only preview, we fall back to
 *   `VERTEX_TOPIC_FALLBACK_MODEL` or `gemini-2.5-pro` so local Vertex dev does not 404.
 */
export function resolveVertexTopicModelId(fallbackFromGeminiModel: string): {
  modelId: string;
  source: "VERTEX_GEMINI_MODEL" | "GEMINI_MODEL" | "VERTEX_AUTO_FALLBACK";
} {
  const vertexOnly = process.env.VERTEX_GEMINI_MODEL?.trim();
  if (vertexOnly) {
    return { modelId: vertexOnly, source: "VERTEX_GEMINI_MODEL" };
  }

  const normalized = fallbackFromGeminiModel.trim();
  const key = normalized.toLowerCase();
  if (VERTEX_TYPICAL_404_IDS.has(key)) {
    const fallback =
      process.env.VERTEX_TOPIC_FALLBACK_MODEL?.trim() || "gemini-2.5-pro";
    console.warn(
      `[geminiModel] Vertex: "${normalized}" is usually unavailable on Vertex; using "${fallback}". ` +
        "Set VERTEX_GEMINI_MODEL (or VERTEX_TOPIC_FALLBACK_MODEL) to override."
    );
    return { modelId: fallback, source: "VERTEX_AUTO_FALLBACK" };
  }

  return { modelId: normalized, source: "GEMINI_MODEL" };
}
