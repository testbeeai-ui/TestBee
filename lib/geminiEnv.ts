/**
 * Gemini API key for the AI Studio path (non-Vertex).
 * Prefer `GEMINI_API_KEY` (documented in this repo); accept common alternates from Google samples / other templates.
 */
export function getGeminiApiKeyFromEnv(): string | undefined {
  const candidates = [
    process.env.GEMINI_API_KEY,
    process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    process.env.GOOGLE_AI_API_KEY,
  ];
  for (const raw of candidates) {
    const v = raw?.trim();
    if (v) return v;
  }
  return undefined;
}
