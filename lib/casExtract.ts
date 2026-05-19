/**
 * lib/casExtract.ts — Extract calculable math blocks from Prof-Pi answer markdown.
 *
 * Parses **Answer:**, **Formula:**, **Steps:** sections and extracts LaTeX expressions
 * along with the detected operation type from the question context.
 */

export type CalcOperation = "integrate" | "differentiate" | "simplify" | "solve" | "limit" | "evaluate" | "equivalent";

export type ExtractedCalc = {
  operation: CalcOperation;
  expression: string; // LaTeX of the input
  variable: string; // e.g. "x"
  claimedResult: string; // LaTeX of the answer
  sectionHeader: string; // which section it came from
};

// ---------------------------------------------------------------------------
// Operation detection from question text
// ---------------------------------------------------------------------------

const OPERATION_PATTERNS: Array<{ pattern: RegExp; op: CalcOperation }> = [
  { pattern: /\bintegrat|antiderivative|find\s+(?:the\s+)?integral|∫/i, op: "integrate" },
  { pattern: /\bderiv|differentiat|find\s+(?:dy|dz|du|dv|dw)\s*\/\s*dx|d\/dx|dy\/dx/i, op: "differentiate" },
  { pattern: /\blimit\b|\blim\b|approaches?\b/i, op: "limit" },
  { pattern: /\bsolve\b|\bfind\s+(?:the\s+)?(?:roots?|zeros?|values?\s+of\s+x)|equation\b/i, op: "solve" },
  { pattern: /\bsimplif|reduce\b/i, op: "simplify" },
  { pattern: /\bevaluat|calculat|find\s+(?:the\s+)?(?:value|result)|compute\b/i, op: "evaluate" },
];

function detectOperation(text: string): CalcOperation | null {
  const lower = text.toLowerCase();
  for (const { pattern, op } of OPERATION_PATTERNS) {
    if (pattern.test(lower)) return op;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Variable detection
// ---------------------------------------------------------------------------

const COMMON_VARS = ["x", "y", "z", "t", "u", "v", "w", "r", "θ", "theta"];

function detectVariable(text: string): string {
  // Look for "with respect to" patterns
  const wrt = text.match(/(?:w\.?r\.?t\.?|with\s+respect\s+to|differentiate\s+(?:with\s+)?(?:respect\s+)?(?:to\s+)?)\s*([a-zθ])/i);
  if (wrt?.[1]) return wrt[1];

  // Look for dx, dy, dz in integrals
  const dvar = text.match(/\bd([a-zθ])\b/);
  if (dvar?.[1]) return dvar[1];

  return "x"; // default
}

// ---------------------------------------------------------------------------
// LaTeX extraction from markdown
// ---------------------------------------------------------------------------

/** Extract all LaTeX blocks from a string ($...$ and $$...$$). */
function extractLatexBlocks(text: string): string[] {
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

/** Find the content under a bold section header like **Answer:** or **Formula:**. */
function findSectionContent(markdown: string, headerPattern: RegExp): string | null {
  const match = markdown.match(headerPattern);
  if (!match?.index) return null;

  const start = match.index + match[0].length;
  // Capture until the next bold header or end of string
  const rest = markdown.slice(start);
  const nextHeader = rest.match(/\n\s*\*\*[A-Z][^*]*\*\*/);
  const end = nextHeader?.index ?? rest.length;
  return rest.slice(0, end).trim();
}

// ---------------------------------------------------------------------------
// Main extraction
// ---------------------------------------------------------------------------

/**
 * Extract calculable math blocks from a Prof-Pi answer.
 *
 * Strategy:
 * 1. Detect operation from doubt title + body
 * 2. Find **Answer:** section → extract LaTeX as claimed result
 * 3. Find **Formula:** section → extract LaTeX as expression
 * 4. If no explicit sections, try to extract from the whole answer
 */
export function extractCalculations(params: {
  answerMarkdown: string;
  doubtTitle: string;
  doubtBody: string;
  subject: "physics" | "math" | "chemistry";
}): ExtractedCalc[] {
  const { answerMarkdown, doubtTitle, doubtBody, subject } = params;
  const questionText = `${doubtTitle}\n${doubtBody}`;
  const results: ExtractedCalc[] = [];

  // Detect operation from question
  const operation = detectOperation(questionText);
  if (!operation) return results;

  // Detect variable
  const variable = detectVariable(questionText);

  // Find answer section
  const answerContent = findSectionContent(
    answerMarkdown,
    /\*\*(?:Answer|Solution|Result)\s*:?\*\*/i
  );

  // Find formula section
  const formulaContent = findSectionContent(
    answerMarkdown,
    /\*\*(?:Formula|Expression|Integrand|Derivative)\s*:?\*\*/i
  );

  // Extract LaTeX from answer section
  const answerLatex = answerContent ? extractLatexBlocks(answerContent) : [];
  const formulaLatex = formulaContent ? extractLatexBlocks(formulaContent) : [];

  if (answerLatex.length > 0) {
    // Use formula section as expression if available, otherwise use question
    const expression = formulaLatex.length > 0
      ? formulaLatex[formulaLatex.length - 1] // last formula = the main one
      : _extractExpressionFromQuestion(questionText, operation);

    for (const ans of answerLatex) {
      results.push({
        operation,
        expression: expression || "",
        variable,
        claimedResult: ans,
        sectionHeader: "Answer",
      });
    }
  } else if (subject === "math" || subject === "physics") {
    // No explicit answer section — try extracting from the full answer
    const allBlocks = extractLatexBlocks(answerMarkdown);
    if (allBlocks.length >= 2) {
      // Last substantial block is likely the answer
      const lastBlock = allBlocks[allBlocks.length - 1];
      const expression = formulaLatex.length > 0
        ? formulaLatex[0]
        : _extractExpressionFromQuestion(questionText, operation);

      if (lastBlock && lastBlock.length > 4) {
        results.push({
          operation,
          expression: expression || "",
          variable,
          claimedResult: lastBlock,
          sectionHeader: "inferred",
        });
      }
    }
  }

  return results;
}

/** Try to extract the main expression from the question text itself. */
function _extractExpressionFromQuestion(questionText: string, operation: CalcOperation): string {
  const blocks = extractLatexBlocks(questionText);
  if (blocks.length === 0) return "";

  // For integrals, the first block is usually the integrand
  // For derivatives, the first block is usually the function
  // For solve, the first block is usually the equation
  return blocks[0];
}

/**
 * Check if the subject + question suggest CAS verification is worthwhile.
 * Skips chemistry (atom balance is different) and purely conceptual questions.
 */
export function shouldRunCasVerification(params: {
  subject: string;
  doubtTitle: string;
  doubtBody: string;
}): boolean {
  const { subject, doubtTitle, doubtBody } = params;

  // Only math and physics
  if (subject !== "math" && subject !== "physics") return false;

  const text = `${doubtTitle}\n${doubtBody}`.toLowerCase();

  // Must have some math operation keywords
  const hasMathOp = OPERATION_PATTERNS.some(({ pattern }) => pattern.test(text));

  // Or have LaTeX in the question (suggests a concrete calculation)
  const hasLatex = /\$[^$]+\$|\$\$[^$]+\$\$/.test(`${doubtTitle}\n${doubtBody}`);

  // Or have numbers (numerical problem)
  const hasNumbers = /\d+/.test(doubtBody || doubtTitle);

  return hasMathOp || (hasLatex && hasNumbers);
}
