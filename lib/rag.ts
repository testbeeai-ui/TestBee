/**
 * lib/rag.ts — TypeScript RAG client for the retrieval service.
 *
 * Calls POST /retrieve on RAG_SIDECAR_URL (e.g. Modal ASGI deployment) and returns formatted textbook passages.
 * Returns null on ANY failure so the caller can gracefully fall back to LLM-only.
 *
 * Server-side only (uses process.env).
 */

import { RAG_CONTEXT_MAX_CHARS, truncateForPrompt } from "@/lib/gyanContentPolicy";

// Generic conversational follow-ups that produce garbage retrieval results.
// Short but SPECIFIC queries like "p-n junction" or "Define capacitance" still pass through.
const GENERIC_FOLLOW_UPS =
  /^(why|how|explain|tell me more|give an example|can you explain|what does that mean|elaborate|continue|go on|yes|no|ok|okay|thanks|thank you|huh|what about that|can you give|more examples?|another example|i (don't|dont) understand|repeat that|say that again|what)\s*\??$/i;

const SUBJECT_LABELS: Record<string, string> = {
  physics:   "Physics",
  chemistry: "Chemistry",
  math:      "Mathematics",
  biology:   "Biology",
};

export type QueryIntent = "formula" | "definition" | "derivation" | "example" | "comparison" | "general";

function classifyIntent(query: string): QueryIntent {
  const q = query.toLowerCase();
  if (/\bformula[s]?\b|\bequation[s]?\b|\bexpression[s]?\b/.test(q)) return "formula";
  if (/\bdefin|\bmeaning of\b|\bwhat is\b/.test(q)) return "definition";
  if (/\bderiv|\bproof\b|\bshow that\b|\bprove\b/.test(q)) return "derivation";
  if (/\bexample|\bsolved\b|\bquestion\b/.test(q)) return "example";
  if (/\bdifferen|\bcompar|\bvs\b/.test(q)) return "comparison";
  return "general";
}

function buildIntentPrefix(intent: QueryIntent, subjectLabel: string): string {
  const prefixes: Record<QueryIntent, string> = {
    formula:    `${subjectLabel} formulas and equations for`,
    definition: `${subjectLabel} definition and explanation of`,
    derivation: `${subjectLabel} derivation and proof of`,
    example:    `${subjectLabel} worked example of`,
    comparison: `${subjectLabel} comparison of`,
    general:    subjectLabel,
  };
  return prefixes[intent];
}

export interface RAGContext {
  formattedContext: string; // The "--- TEXTBOOK PASSAGES ---" block
  chunkCount: number;
}

/** True when the query matches “generic chat” patterns and RAG is skipped client-side. */
export function isRagSkippedAsGenericQuery(query: string): boolean {
  return GENERIC_FOLLOW_UPS.test(query.trim());
}

/**
 * How the sidecar request is built (for admin traces / debugging).
 * Does not call the network.
 */
export function buildRAGRequestTrace(
  query: string,
  subject: string,
  gradeLevel: number,
  topic?: string,
  subtopic?: string,
  matchCount = 5
): {
  baseQuery: string;
  augmentedQuery: string;
  intent: QueryIntent;
  sidecarConfigured: boolean;
  skippedAsGeneric: boolean;
  sidecarPath: string;
  postBody: { query: string; subject: string; grade_level: number; match_count: number };
} {
  const sidecarConfigured = Boolean(process.env.RAG_SIDECAR_URL?.trim());
  const skippedAsGeneric = isRagSkippedAsGenericQuery(query);
  const subjectLabel = SUBJECT_LABELS[subject] ?? subject;
  const intent = classifyIntent(query);
  const intentPrefix = buildIntentPrefix(intent, subjectLabel);
  const parts = [intentPrefix, topic, subtopic, query].filter(Boolean);
  const augmentedQuery = parts.join(". ");
  return {
    baseQuery: query,
    augmentedQuery,
    intent,
    sidecarConfigured,
    skippedAsGeneric,
    sidecarPath: "/retrieve",
    postBody: {
      query: augmentedQuery,
      subject,
      grade_level: gradeLevel,
      match_count: matchCount,
    },
  };
}

function buildAugmentedRagQuery(
  query: string,
  subject: string,
  topic?: string,
  subtopic?: string
): { augmentedQuery: string; intent: QueryIntent } {
  const subjectLabel = SUBJECT_LABELS[subject] ?? subject;
  const intent = classifyIntent(query);
  const intentPrefix = buildIntentPrefix(intent, subjectLabel);
  const parts = [intentPrefix, topic, subtopic, query].filter(Boolean);
  return { augmentedQuery: parts.join(". "), intent };
}

/**
 * Fetch RAG context from RAG_SIDECAR_URL (Modal or any compatible /retrieve API).
 *
 * @returns RAGContext if relevant passages found, null otherwise.
 *          NEVER throws — all errors are caught and logged.
 *
 * @param maxFormattedChars — cap on formatted passage text (default from gyanContentPolicy). Pass a larger value for long-form agents if needed.
 */
export async function fetchRAGContext(
  query: string,
  subject: string,
  gradeLevel: number,
  topic?: string,
  subtopic?: string,
  matchCount = 5,
  maxFormattedChars?: number,
): Promise<RAGContext | null> {
  const sidecarUrl = process.env.RAG_SIDECAR_URL;

  // RAG disabled if env var not set
  if (!sidecarUrl) {
    return null;
  }

  // Skip RAG for generic conversational follow-ups
  if (isRagSkippedAsGenericQuery(query)) {
    return null;
  }

  const timeoutRaw = Number(process.env.RAG_RETRIEVE_TIMEOUT_MS);
  const timeoutMs =
    Number.isFinite(timeoutRaw) && timeoutRaw >= 5_000 && timeoutRaw <= 180_000
      ? timeoutRaw
      : 60_000; // 60s default — Modal / cold sidecars often exceed 25s

  try {
    const { augmentedQuery } = buildAugmentedRagQuery(query, subject, topic, subtopic);

    const internalToken = process.env.RAG_INTERNAL_TOKEN;

    const response = await fetch(`${sidecarUrl}/retrieve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(internalToken ? { "X-Internal-Token": internalToken } : {}),
      },
      body: JSON.stringify({
        query: augmentedQuery,
        subject,
        grade_level: gradeLevel,
        match_count: matchCount,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      console.warn(
        `[RAG] RAG service returned ${response.status}: ${response.statusText}`,
      );
      return null;
    }

    const data = await response.json();

    if (!data.chunk_count || data.chunk_count === 0) {
      console.warn("[RAG] No relevant chunks found for query");
      return null;
    }

    console.info(`[RAG] Enriched prompt with ${data.chunk_count} passages`);

    const envCapRaw = process.env.RAG_FORMATTED_CONTEXT_MAX_CHARS?.trim();
    const envCap =
      envCapRaw && Number.isFinite(Number.parseInt(envCapRaw, 10)) && Number.parseInt(envCapRaw, 10) > 0
        ? Number.parseInt(envCapRaw, 10)
        : undefined;
    const cap = maxFormattedChars ?? envCap ?? RAG_CONTEXT_MAX_CHARS;
    const rawFmt = typeof data.formatted_context === "string" ? data.formatted_context : "";
    const formattedContext = truncateForPrompt(rawFmt, cap);

    return {
      formattedContext,
      chunkCount: data.chunk_count,
    };
  } catch (error) {
    // Network error, timeout, JSON parse error, etc.
    const isTimeout =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.message.toLowerCase().includes("timeout"));
    if (isTimeout) {
      console.warn(
        `[RAG] Request timed out (limit ${timeoutMs}ms). ` +
          "Increase RAG_RETRIEVE_TIMEOUT_MS or check Modal cold starts. Falling back to LLM-only."
      );
    } else {
      console.warn("[RAG] RAG service unreachable, falling back to LLM-only:", error);
    }
    return null;
  }
}
