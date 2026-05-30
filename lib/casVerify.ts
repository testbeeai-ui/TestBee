/**
 * lib/casVerify.ts — TypeScript client for the SymPy CAS verification sidecar.
 *
 * Calls POST /verify-calc on RAG_SIDECAR_URL (same Modal deployment).
 * Returns null on ANY failure so the caller can gracefully skip verification.
 *
 * Server-side only (uses process.env).
 */

import type { CalcOperation } from "@/lib/casExtract";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CalcVerifyResult = {
  correct: boolean;
  computed: string | null;
  confidence: "high" | "medium" | "low";
  explanation: string;
  error: string | null;
  // Multi-step support
  steps?: Array<{
    step: number;
    operation: string;
    input: string;
    output: string;
    correct: boolean;
    confidence: string;
    explanation?: string;
  }>;
  detectedType?: string | null;
};

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

/**
 * Verify a single calculation via the CAS sidecar.
 *
 * @returns CalcVerifyResult if the sidecar responded, null if unavailable/failed.
 */
export async function verifyCalculation(params: {
  operation: CalcOperation;
  expression: string;
  variable?: string;
  claimedResult: string;
  gradeLevel?: number;
  // Multi-step support
  steps?: Array<{
    operation: string;
    expression: string;
    variable: string;
    params?: Record<string, unknown>;
  }>;
  params?: Record<string, unknown>;
  questionText?: string;
}): Promise<CalcVerifyResult | null> {
  const sidecarUrl = process.env.RAG_SIDECAR_URL;
  if (!sidecarUrl) return null;

  try {
    const internalToken = process.env.RAG_INTERNAL_TOKEN;
    // Multi-step gets more time
    const timeoutMs = params.steps && params.steps.length > 1 ? 10_000 : 5_000;

    const response = await fetch(`${sidecarUrl}/verify-calc`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(internalToken ? { "X-Internal-Token": internalToken } : {}),
      },
      body: JSON.stringify({
        operation: params.operation,
        expression: params.expression,
        variable: params.variable ?? "x",
        claimed_result: params.claimedResult,
        grade_level: params.gradeLevel ?? 12,
        steps: params.steps ?? [],
        params: params.params ?? {},
        question_text: params.questionText ?? "",
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      console.warn(`[CAS] Sidecar returned ${response.status}: ${response.statusText}`);
      return null;
    }

    const data = await response.json();

    return {
      correct: Boolean(data.correct),
      computed: data.computed ?? null,
      confidence: data.confidence ?? "low",
      explanation: data.explanation ?? "",
      error: data.error ?? null,
      steps: data.steps ?? [],
      detectedType: data.detected_type ?? null,
    };
  } catch (error) {
    const isTimeout =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.message.toLowerCase().includes("timeout"));
    if (isTimeout) {
      console.warn("[CAS] Verification timed out. Skipping.");
    } else {
      console.warn("[CAS] Sidecar unreachable, skipping verification:", error);
    }
    return null;
  }
}
