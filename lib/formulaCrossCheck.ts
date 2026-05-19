/**
 * lib/formulaCrossCheck.ts — Cross-check Sarvam's formula against RAG textbook passages.
 *
 * After Sarvam generates an answer, this module:
 * 1. Extracts the main formula from the answer's **Formula:** section
 * 2. Extracts formulas from the RAG textbook passages
 * 3. Compares them using CAS symbolic equivalence
 * 4. Returns whether the formula matches, and the correct textbook formula if not
 *
 * This is general across all physics/math topics — no hardcoded formulas.
 */

import type { CalcOperation } from "@/lib/casExtract";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FormulaCrossCheckResult = {
  ran: boolean;
  matches: boolean | null;
  textbookFormula: string | null;
  answerFormula: string | null;
  confidence: "high" | "medium" | "low";
};

// ---------------------------------------------------------------------------
// LaTeX extraction
// ---------------------------------------------------------------------------

/** Extract all LaTeX blocks from text ($...$ and $$...$$). */
function extractAllLatex(text: string): string[] {
  const blocks: string[] = [];

  // Display math: $$...$$
  for (const m of text.matchAll(/\$\$([\s\S]+?)\$\$/g)) {
    const block = m[1]?.trim();
    if (block) blocks.push(`$$${block}$$`);
  }

  // Inline math: $...$ (but not $$)
  for (const m of text.matchAll(/(?<!\$)\$(?!\$)([^\$\n]+?)\$(?!\$)/g)) {
    const block = m[1]?.trim();
    if (block && block.length > 2) blocks.push(`$${block}$`);
  }

  return blocks;
}

/** Find the content under a bold section header. */
function findSectionContent(markdown: string, headerPattern: RegExp): string | null {
  const match = markdown.match(headerPattern);
  if (!match?.index) return null;

  const start = match.index + match[0].length;
  const rest = markdown.slice(start);
  const nextHeader = rest.match(/\n\s*\*\*[A-Z][^*]*\*\*/);
  const end = nextHeader?.index ?? rest.length;
  return rest.slice(0, end).trim();
}

/**
 * Check if a LaTeX block looks like a formula/equation (not just a number or variable).
 * Must contain at least one of: =, ∫, d/dx, Σ, trig functions, powers, fractions.
 */
function looksLikeFormula(latex: string): boolean {
  const indicators = /[=∫∑∏\\frac|\\sin|\\cos|\\tan|\\log|\\lim|\\sqrt|\^|_.*=|d[a-z]\/d[a-z]|\\vec|\\nabla|\\partial/i;
  return indicators.test(latex) && latex.length > 5;
}

// ---------------------------------------------------------------------------
// Formula extraction from answer
// ---------------------------------------------------------------------------

/** Extract the main formula from Sarvam's answer. */
function extractAnswerFormula(answer: string): string | null {
  // Try **Formula:** section first
  const formulaSection = findSectionContent(answer, /\*\*(?:Formula|Governing\s*(?:law|equation)|Principle)\s*:?\*\*/i);
  if (formulaSection) {
    const blocks = extractAllLatex(formulaSection);
    const formulas = blocks.filter(looksLikeFormula);
    if (formulas.length > 0) return formulas[0];
    // If no equation-like blocks, take the first substantial block
    if (blocks.length > 0 && blocks[0].length > 4) return blocks[0];
  }

  // Fallback: look for the first equation-like LaTeX in the whole answer
  const allBlocks = extractAllLatex(answer);
  for (const block of allBlocks) {
    if (looksLikeFormula(block)) return block;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Formula extraction from RAG passages
// ---------------------------------------------------------------------------

/** Extract formulas from RAG textbook passages. */
function extractRagFormulas(ragContext: string): string[] {
  const blocks = extractAllLatex(ragContext);
  return blocks.filter(looksLikeFormula);
}

// ---------------------------------------------------------------------------
// CAS equivalence check
// ---------------------------------------------------------------------------

type EquivResult = {
  equivalent: boolean;
  confidence: "high" | "medium" | "low";
};

/** Check if two LaTeX expressions are symbolically equivalent via CAS. */
async function checkEquivalence(expr1: string, expr2: string): Promise<EquivResult | null> {
  const sidecarUrl = process.env.RAG_SIDECAR_URL;
  if (!sidecarUrl) return null;

  try {
    const internalToken = process.env.RAG_INTERNAL_TOKEN;

    const response = await fetch(`${sidecarUrl}/verify-calc`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(internalToken ? { "X-Internal-Token": internalToken } : {}),
      },
      body: JSON.stringify({
        operation: "equivalent" as CalcOperation,
        expression: expr1,
        variable: "x",
        claimed_result: expr2,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) return null;

    const data = await response.json();
    return {
      equivalent: Boolean(data.correct),
      confidence: data.confidence ?? "low",
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main cross-check
// ---------------------------------------------------------------------------

/**
 * Cross-check the formula in Sarvam's answer against RAG textbook passages.
 *
 * Strategy:
 * 1. Extract formula from answer's **Formula:** section
 * 2. Extract formulas from RAG passages
 * 3. For each RAG formula, check CAS equivalence with answer formula
 * 4. If any RAG formula matches → formula is correct
 * 5. If RAG has formulas but none match → formula may be wrong
 */
export async function crossCheckFormulaWithRag(params: {
  answer: string;
  ragContext: string | null;
  subject: string;
}): Promise<FormulaCrossCheckResult> {
  const { answer, ragContext, subject } = params;

  // Only for math and physics
  if (subject !== "math" && subject !== "physics") {
    return { ran: false, matches: null, textbookFormula: null, answerFormula: null, confidence: "low" };
  }

  // Need RAG context
  if (!ragContext || ragContext.length < 50) {
    return { ran: false, matches: null, textbookFormula: null, answerFormula: null, confidence: "low" };
  }

  // Extract formula from answer
  const answerFormula = extractAnswerFormula(answer);
  if (!answerFormula) {
    return { ran: false, matches: null, textbookFormula: null, answerFormula: null, confidence: "low" };
  }

  // Extract formulas from RAG passages
  const ragFormulas = extractRagFormulas(ragContext);
  if (ragFormulas.length === 0) {
    return { ran: false, matches: null, textbookFormula: null, answerFormula, confidence: "low" };
  }

  // Compare answer formula against each RAG formula
  for (const ragFormula of ragFormulas) {
    const result = await checkEquivalence(answerFormula, ragFormula);
    if (!result) continue; // CAS unavailable

    if (result.equivalent) {
      return {
        ran: true,
        matches: true,
        textbookFormula: ragFormula,
        answerFormula,
        confidence: result.confidence,
      };
    }
  }

  // No RAG formula matched — formula may be wrong
  // Use the first RAG formula as the "correct" one (most relevant passage)
  return {
    ran: true,
    matches: false,
    textbookFormula: ragFormulas[0],
    answerFormula,
    confidence: "medium",
  };
}
