/**
 * Server-side readiness flags for Gyan++ bot (no secrets exposed).
 */

export type GyanBotCapabilities = {
  sarvamConfigured: boolean;
  ragSidecarConfigured: boolean;
  ragInternalTokenSet: boolean;
  cronSecretConfigured: boolean;
  serviceRoleConfigured: boolean;
  /** True when running on Vercel production deployment. */
  vercelProduction: boolean;
};

export function getGyanBotCapabilities(): GyanBotCapabilities {
  return {
    sarvamConfigured: Boolean(process.env.SARVAM_API_KEY?.trim()),
    ragSidecarConfigured: Boolean(process.env.RAG_SIDECAR_URL?.trim()),
    ragInternalTokenSet: Boolean(process.env.RAG_INTERNAL_TOKEN?.trim()),
    cronSecretConfigured: Boolean(process.env.CRON_SECRET?.trim()),
    serviceRoleConfigured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
    vercelProduction: process.env.VERCEL_ENV === "production",
  };
}

/** Human-readable setup gaps for the admin panel (no secret values). */
export function getGyanBotSetupWarnings(caps: GyanBotCapabilities): string[] {
  const w: string[] = [];
  if (!caps.serviceRoleConfigured) {
    w.push("SUPABASE_SERVICE_ROLE_KEY is missing — admin bot APIs and inserts will fail.");
  }
  if (!caps.sarvamConfigured) {
    w.push("SARVAM_API_KEY is missing — student doubts and Prof-Pi answers cannot be generated.");
  }
  if (!caps.ragSidecarConfigured) {
    w.push("RAG_SIDECAR_URL is missing — CBSE textbook retrieval is off; Sarvam still uses syllabus-style prompts.");
  }
  if (caps.vercelProduction && !caps.cronSecretConfigured) {
    w.push("Vercel production: set CRON_SECRET — scheduled /api/cron/gyan-bot-post calls are blocked until it is set.");
  }
  if (caps.vercelProduction && caps.ragSidecarConfigured && !caps.ragInternalTokenSet) {
    w.push("RAG sidecar URL is set but RAG_INTERNAL_TOKEN is empty — if your retriever requires auth, fix this or retrieval will fail.");
  }
  return w;
}
