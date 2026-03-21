/**
 * lib/rag.ts — TypeScript RAG client for the FastAPI sidecar.
 *
 * Calls POST /retrieve on the sidecar and returns formatted textbook passages.
 * Returns null on ANY failure so the caller can gracefully fall back to LLM-only.
 *
 * Server-side only (uses process.env).
 */

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

type QueryIntent = "formula" | "definition" | "derivation" | "example" | "comparison" | "general";

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

/**
 * Fetch RAG context from the sidecar.
 *
 * @returns RAGContext if relevant passages found, null otherwise.
 *          NEVER throws — all errors are caught and logged.
 */
export async function fetchRAGContext(
  query: string,
  subject: string,
  gradeLevel: number,
  topic?: string,
  subtopic?: string,
): Promise<RAGContext | null> {
  const sidecarUrl = process.env.RAG_SIDECAR_URL;

  // RAG disabled if env var not set
  if (!sidecarUrl) {
    return null;
  }

  // Skip RAG for generic conversational follow-ups
  if (GENERIC_FOLLOW_UPS.test(query.trim())) {
    return null;
  }

  try {
    // Augment with subject label + intent-aware prefix so the embedding is
    // anchored in the correct domain even for vague queries like "give me formulas".
    const subjectLabel = SUBJECT_LABELS[subject] ?? subject;
    const intent = classifyIntent(query);
    const intentPrefix = buildIntentPrefix(intent, subjectLabel);
    // Period-separated: BGE-M3 treats "." as a soft sentence boundary, preserving
    // semantic weight of each segment instead of blending into one long noun phrase.
    const parts = [intentPrefix, topic, subtopic, query].filter(Boolean);
    const augmentedQuery = parts.join(". ");

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
        match_count: 8,
      }),
      signal: AbortSignal.timeout(25000), // 25s — accommodates Modal cold start
    });

    if (!response.ok) {
      console.warn(
        `[RAG] Sidecar returned ${response.status}: ${response.statusText}`,
      );
      return null;
    }

    const data = await response.json();

    if (!data.chunk_count || data.chunk_count === 0) {
      console.warn("[RAG] No relevant chunks found for query");
      return null;
    }

    console.info(`[RAG] Enriched prompt with ${data.chunk_count} passages`);

    return {
      formattedContext: data.formatted_context,
      chunkCount: data.chunk_count,
    };
  } catch (error) {
    // Network error, timeout, JSON parse error, etc.
    console.warn("[RAG] Sidecar unreachable, falling back to LLM-only:", error);
    return null;
  }
}
