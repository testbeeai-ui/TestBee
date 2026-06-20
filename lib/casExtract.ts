/**
 * lib/casExtract.ts — Extract calculable math blocks from Prof-Pi answer markdown.
 *
 * Parses **Answer:**, **Formula:**, **Steps:** sections and extracts LaTeX expressions
 * along with the detected operation type from the question context.
 *
 * Supports 40+ operation types covering JEE/JEE Advanced/NEET syllabus.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CalcOperation =
  // Original 7
  | "integrate"
  | "differentiate"
  | "simplify"
  | "solve"
  | "limit"
  | "evaluate"
  | "equivalent"
  // New solver operations
  | "nested_radical"
  | "compose_functions"
  | "recurrence_relation"
  | "infinite_series"
  | "sequence_limit"
  | "modular_arithmetic"
  | "algebra"
  | "quadratic"
  | "factor_polynomial"
  | "inequality"
  | "system_of_equations"
  | "trigonometry"
  | "trig_identity"
  | "complex_numbers"
  | "roots_of_unity"
  | "coordinate_geometry"
  | "conic_section"
  | "vectors"
  | "dot_product"
  | "cross_product"
  | "three_d_geometry"
  | "linear_algebra"
  | "determinant"
  | "eigenvalue"
  | "discrete"
  | "permutation"
  | "combination"
  | "binomial_theorem"
  | "number_theory"
  | "probability"
  | "conditional_probability"
  | "ode"
  | "differential_equation"
  | "sequences_series"
  | "arithmetic_progression"
  | "geometric_progression"
  | "statistics"
  | "continuity"
  | "differentiability"
  | "mvt"
  | "applications_calc"
  | "maxima_minima"
  | "area_under_curve"
  | "sets_relations"
  | "logic"
  | "special"
  | "multi_step";

export type CalcStep = {
  operation: CalcOperation;
  expression: string;
  variable: string;
  params?: Record<string, unknown>;
};

export type ExtractedCalc = {
  operation: CalcOperation;
  expression: string;
  variable: string;
  claimedResult: string;
  sectionHeader: string;
  // Multi-step support
  steps?: CalcStep[];
  params?: Record<string, unknown>;
  questionText?: string;
};

// ---------------------------------------------------------------------------
// Operation detection from question text
// ---------------------------------------------------------------------------

const OPERATION_PATTERNS: Array<{ pattern: RegExp; op: CalcOperation }> = [
  // === MOST SPECIFIC FIRST (to avoid false matches) ===

  // Nested radicals
  {
    pattern: /nested\s*radical|\\sqrt\s*\{.*\\sqrt\s*\{|√.*√|infinite.*radical/i,
    op: "nested_radical",
  },

  // Function composition
  {
    pattern: /f\s*\(\s*f\s*\(|function.*compos|f\^2|f\^3|compose.*function/i,
    op: "compose_functions",
  },

  // Recurrence relations
  {
    pattern: /recurrence|a_\{?n\s*\+\s*1\}?|a_\(n\+1\)|closed\s*form.*sequence/i,
    op: "recurrence_relation",
  },

  // Infinite series
  {
    pattern: /\\sum.*\\infty|\\sum.*oo|infinite\s*series|convergence.*series/i,
    op: "infinite_series",
  },

  // Sequence limits with factorials
  { pattern: /factorial.*limit|n!.*limit|stirling|ⁿ√.*n!|n-th.*root.*n!/i, op: "sequence_limit" },

  // Clock / modular arithmetic
  {
    pattern: /clock.*backward|clock.*slow|clock.*half|modular.*arithmetic|remainder.*when/i,
    op: "modular_arithmetic",
  },

  // Number theory
  {
    pattern:
      /euler.*totient|euler.*phi|fermat.*little|wilson.*theorem|chinese.*remainder|prime.*factor/i,
    op: "number_theory",
  },

  // Binomial theorem
  {
    pattern: /binomial.*theorem|binomial.*expansion|general.*term.*binomial/i,
    op: "binomial_theorem",
  },

  // Differential equations
  {
    pattern: /differential.*equation|\\bODE\\b|dsolve|order.*degree/i,
    op: "differential_equation",
  },

  // Maxima/minima / optimization
  { pattern: /maxima|minima|maximum.*value|minimum.*value|optimiz/i, op: "maxima_minima" },

  // Area under curve
  { pattern: /area.*under.*curve|area.*between.*curve|area.*region/i, op: "area_under_curve" },

  // Continuity / differentiability
  { pattern: /continuity|continuous|discontinuity|differentiab/i, op: "continuity" },

  // Mean Value Theorem / Rolle's
  { pattern: /rolle.*theorem|mean.*value.*theorem|\\bMVT\\b|lagrange/i, op: "mvt" },

  // Eigenvalues
  { pattern: /eigenvalue|eigenvector|characteristic.*equation/i, op: "eigenvalue" },

  // Determinant
  { pattern: /determinant|det\(|\|A\|/i, op: "determinant" },

  // 3D geometry
  {
    pattern: /3d.*geometry|three.*dimensional|direction.*cosine|skew.*line|equation.*plane/i,
    op: "three_d_geometry",
  },

  // Vectors
  {
    pattern: /dot\s*product|cross\s*product|scalar.*triple|vector.*product|projection.*vector/i,
    op: "vectors",
  },

  // Conic sections
  { pattern: /parabola|ellipse|hyperbola|conic.*section|focus.*directrix/i, op: "conic_section" },

  // Complex numbers
  {
    pattern:
      /complex.*number|modulus.*argument|de\s*moivre|roots?\s*of\s*unity|conjugate.*complex/i,
    op: "complex_numbers",
  },

  // Trigonometry
  {
    pattern:
      /trig.*identit|trig.*equation|inverse.*trig|arcsin|arccos|arctan|general.*solution.*trig/i,
    op: "trigonometry",
  },

  // Probability
  {
    pattern: /conditional.*prob|bayes.*theorem|binomial.*distribut|poisson|normal.*distribut/i,
    op: "probability",
  },

  // Statistics
  {
    pattern: /mean.*median.*mode|variance|standard.*deviation|coefficient.*variation/i,
    op: "statistics",
  },

  // Permutations / Combinations
  { pattern: /permut|circular.*permut|\\bnPr\\b/i, op: "permutation" },
  { pattern: /combin|\\bnCr\\b|\\binom\b|choose/i, op: "combination" },

  // Sequences / Series (AP, GP)
  { pattern: /arithmetic.*progression|\\bAP\\b|common.*difference/i, op: "arithmetic_progression" },
  { pattern: /geometric.*progression|\\bGP\\b|common.*ratio/i, op: "geometric_progression" },

  // Sets / Relations
  {
    pattern:
      /set.*operation|union.*intersection|reflexive|symmetric.*relation|transitive|equivalence.*class/i,
    op: "sets_relations",
  },

  // Logic
  {
    pattern: /tautolog|contradiction|converse.*statement|contrapositive|truth.*table/i,
    op: "logic",
  },

  // Coordinate geometry
  {
    pattern: /straight.*line|circle.*equation|tangent.*circle|distance.*formula/i,
    op: "coordinate_geometry",
  },

  // Special functions
  { pattern: /ceiling|floor|fractional.*part|signum|\\bceil\\b/i, op: "special" },

  // Matrix / Linear algebra
  { pattern: /matrix|matrices|adjoint|inverse.*matrix|row.*echelon/i, op: "linear_algebra" },

  // Inequality
  { pattern: /inequality|≥|≤|greater.*or.*equal|less.*or.*equal/i, op: "inequality" },

  // Quadratic
  { pattern: /quadratic|discriminant|nature.*roots|vieta/i, op: "quadratic" },

  // Polynomial factorization
  { pattern: /factor.*polynomial|polynomial.*factor/i, op: "factor_polynomial" },

  // System of equations
  { pattern: /system.*equation|simultaneous/i, op: "system_of_equations" },

  // === ORIGINAL 6 (broad patterns, last to avoid false matches) ===
  { pattern: /\bintegrat|antiderivative|find\s+(?:the\s+)?integral|∫|\\int/i, op: "integrate" },
  {
    pattern: /\bderiv|differentiat|find\s+(?:dy|dz|du|dv|dw)\s*\/\s*dx|d\/dx|dy\/dx/i,
    op: "differentiate",
  },
  { pattern: /\blimit\b|\blim\b|approaches?\b|\\lim/i, op: "limit" },
  {
    pattern: /\bsolve\b|\bfind\s+(?:the\s+)?(?:roots?|zeros?|values?\s+of\s+x)|equation\b/i,
    op: "solve",
  },
  { pattern: /\bsimplif|reduce\b/i, op: "simplify" },
  { pattern: /\bevaluat|calculat|find\s+(?:the\s+)?(?:value|result)|compute\b/i, op: "evaluate" },
];

function detectOperation(text: string): CalcOperation | null {
  const lower = text.toLowerCase();
  for (const { pattern, op } of OPERATION_PATTERNS) {
    if (pattern.test(lower)) return op;
  }

  // Language-independent fallback: English keywords didn't match (e.g. the
  // doubt is written in a regional Indian language). Scan for universal math
  // symbols so verification still fires on valid calculations.
  if (/\\int|∫/.test(text)) return "integrate";
  if (/\\lim|\blim\b/i.test(text)) return "limit";
  if (/\\frac\s*\{\s*d\s*\}\s*\{\s*d|d\s*\/\s*dx|dy\s*\/\s*dx/i.test(text)) return "differentiate";
  if (/=|\\le\b|\\ge\b|≤|≥/.test(text)) return "solve";
  // Any other LaTeX present → a concrete expression to evaluate.
  if (/\$[^$]+\$|\$\$[^$]+\$\$/.test(text)) return "evaluate";

  return null;
}

// ---------------------------------------------------------------------------
// Regional header translation (Way B — instant local post-processing)
// ---------------------------------------------------------------------------

type RegionalLang = "kn" | "hi" | "te" | "ta";

/** Unicode script ranges used to detect the regional language of an answer. */
const SCRIPT_RANGES: Array<{ lang: RegionalLang; re: RegExp }> = [
  { lang: "kn", re: /[\u0C80-\u0CFF]/ }, // Kannada
  { lang: "hi", re: /[\u0900-\u097F]/ }, // Devanagari (Hindi)
  { lang: "te", re: /[\u0C00-\u0C7F]/ }, // Telugu
  { lang: "ta", re: /[\u0B80-\u0BFF]/ }, // Tamil
];

/**
 * Localized section-header words per language. Order is most-specific first so
 * compound headers ("Key intuition / Explanation") are replaced before the
 * standalone "Explanation" rule can touch them.
 */
const HEADER_TRANSLATIONS: Record<
  RegionalLang,
  Array<{ keyword: string; localized: string }>
> = {
  kn: [
    { keyword: "Key\\s*intuition(?:\\s*\\/\\s*Explanation)?", localized: "ಮುಖ್ಯ ಒಳನೋಟ" },
    { keyword: "Exam\\s*trap", localized: "ಪರೀಕ್ಷಾ ಎಚ್ಚರಿಕೆ" },
    { keyword: "Explanation", localized: "ವಿವರಣೆ" },
    { keyword: "Given", localized: "ನೀಡಿರುವುದು" },
    { keyword: "Formula", localized: "ಸೂತ್ರ" },
    { keyword: "Steps", localized: "ಹಂತಗಳು" },
    { keyword: "Answer", localized: "ಉತ್ತರ" },
    { keyword: "Solution", localized: "ಪರಿಹಾರ" },
    { keyword: "Proof", localized: "ಸಾಧನೆ" },
  ],
  hi: [
    { keyword: "Key\\s*intuition(?:\\s*\\/\\s*Explanation)?", localized: "मुख्य अंतर्ज्ञान" },
    { keyword: "Exam\\s*trap", localized: "परीक्षा चेतावनी" },
    { keyword: "Explanation", localized: "व्याख्या" },
    { keyword: "Given", localized: "दिया गया" },
    { keyword: "Formula", localized: "सूत्र" },
    { keyword: "Steps", localized: "चरण" },
    { keyword: "Answer", localized: "उत्तर" },
    { keyword: "Solution", localized: "हल" },
    { keyword: "Proof", localized: "उपपत्ति" },
  ],
  te: [
    { keyword: "Key\\s*intuition(?:\\s*\\/\\s*Explanation)?", localized: "ముఖ్య అవగాహన" },
    { keyword: "Exam\\s*trap", localized: "పరీక్ష హెచ్చరిక" },
    { keyword: "Explanation", localized: "వివరణ" },
    { keyword: "Given", localized: "ఇవ్వబడింది" },
    { keyword: "Formula", localized: "సూత్రం" },
    { keyword: "Steps", localized: "దశలు" },
    { keyword: "Answer", localized: "సమాధానం" },
    { keyword: "Solution", localized: "పరిష్కారం" },
    { keyword: "Proof", localized: "నిరూపణ" },
  ],
  ta: [
    { keyword: "Key\\s*intuition(?:\\s*\\/\\s*Explanation)?", localized: "முக்கிய உள்ளுணர்வு" },
    { keyword: "Exam\\s*trap", localized: "தேர்வு எச்சரிக்கை" },
    { keyword: "Explanation", localized: "விளக்கம்" },
    { keyword: "Given", localized: "கொடுக்கப்பட்டது" },
    { keyword: "Formula", localized: "சூத்திரம்" },
    { keyword: "Steps", localized: "படிகள்" },
    { keyword: "Answer", localized: "விடை" },
    { keyword: "Solution", localized: "தீர்வு" },
    { keyword: "Proof", localized: "நிரூபணம்" },
  ],
};

function detectRegionalLang(text: string): RegionalLang | null {
  for (const { lang, re } of SCRIPT_RANGES) {
    if (re.test(text)) return lang;
  }
  return null;
}

/**
 * Translate Prof-Pi's English bold section headers (e.g. `**Answer:**`,
 * `**📐 Formula:**`) into the regional language the answer body is written in.
 *
 * Way B: runs as a fast local post-processing step right before the answer is
 * saved/displayed — 0ms extra latency, $0 extra cost. Any emoji/space prefix
 * and the trailing colon are preserved; only the English keyword is swapped.
 * Returns the text unchanged if no supported regional script is detected.
 */
export function translateEnglishHeadersToRegional(text: string): string {
  if (!text) return text;
  const lang = detectRegionalLang(text);
  if (!lang) return text;

  let out = text;
  for (const { keyword, localized } of HEADER_TRANSLATIONS[lang]) {
    const re = new RegExp(`(\\*\\*[^A-Za-z*]*)(?:${keyword})(\\s*:?\\s*\\*\\*)`, "gi");
    out = out.replace(re, `$1${localized}$2`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Variable detection
// ---------------------------------------------------------------------------

const COMMON_VARS = ["x", "y", "z", "t", "u", "v", "w", "r", "θ", "theta"];

function detectVariable(text: string): string {
  // Look for "with respect to" patterns
  const wrt = text.match(
    /(?:w\.?r\.?t\.?|with\s+respect\s+to|differentiate\s+(?:with\s+)?(?:respect\s+)?(?:to\s+)?)\s*([a-zθ])/i
  );
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

/** Extract the last substantial LaTeX block from text. */
function extractLastLatexBlock(text: string): string {
  const blocks = extractLatexBlocks(text);
  if (blocks.length === 0) return "";
  // Return the last block that's more than just a variable
  for (let i = blocks.length - 1; i >= 0; i--) {
    if (blocks[i].length > 4) return blocks[i];
  }
  return blocks[blocks.length - 1];
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

  // Try multi-step detection first
  const multiSteps = detectMultiStepProblem(questionText, answerMarkdown);
  if (multiSteps && multiSteps.length > 1) {
    const answerContent = findSectionContent(
      answerMarkdown,
      /\*\*[^A-Za-z*]*(?:Answer|Solution|Result)\s*:?\*\*/i
    );
    const answerLatex = answerContent ? extractLatexBlocks(answerContent) : [];
    const claimedResult =
      answerLatex.length > 0
        ? answerLatex[answerLatex.length - 1]
        : extractLastLatexBlock(answerMarkdown);

    if (claimedResult) {
      results.push({
        operation: "multi_step",
        expression: multiSteps[0].expression,
        variable: multiSteps[0].variable,
        claimedResult,
        sectionHeader: "multi_step",
        steps: multiSteps,
        questionText,
      });
      return results;
    }
  }

  // Detect operation from question
  const operation = detectOperation(questionText);
  if (!operation) return results;

  // Detect variable
  const variable = detectVariable(questionText);

  // Find answer section
  const answerContent = findSectionContent(
    answerMarkdown,
    /\*\*[^A-Za-z*]*(?:Answer|Solution|Result)\s*:?\*\*/i
  );

  // Find formula section
  const formulaContent = findSectionContent(
    answerMarkdown,
    /\*\*[^A-Za-z*]*(?:Formula|Expression|Integrand|Derivative)\s*:?\*\*/i
  );

  // Extract LaTeX from answer section
  const answerLatex = answerContent ? extractLatexBlocks(answerContent) : [];
  const formulaLatex = formulaContent ? extractLatexBlocks(formulaContent) : [];

  if (answerLatex.length > 0) {
    // Use formula section as expression if available, otherwise use question
    const expression =
      formulaLatex.length > 0
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
      const expression =
        formulaLatex.length > 0
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

  // Unified detection: verification runs whenever detectOperation resolves an
  // operation — via English keywords OR the language-independent symbol
  // fallback — so regional-language doubts are covered too.
  return detectOperation(`${doubtTitle}\n${doubtBody}`) !== null;
}

// ---------------------------------------------------------------------------
// Multi-step detection
// ---------------------------------------------------------------------------

/**
 * Detect if a question requires multi-step solving.
 * Returns a step chain or null if single-operation.
 */
export function detectMultiStepProblem(
  questionText: string,
  answerMarkdown: string
): CalcStep[] | null {
  const text = questionText.toLowerCase();
  const steps: CalcStep[] = [];

  // Pattern: nested radical → solve → evaluate
  // e.g., "x = √(6 + √(6 + ...)), find x"
  if (/nested.*radical|\\sqrt\s*\{.*\\sqrt\s*\{|√.*√/i.test(text)) {
    const radicalMatch = questionText.match(/\\sqrt\s*\{?\s*(\d+)\s*\+?\s*\\sqrt/i);
    const constant = radicalMatch?.[1] || "6";
    steps.push({
      operation: "nested_radical",
      expression: `\\sqrt{${constant} + \\sqrt{${constant} + \\cdots}}`,
      variable: "x",
    });
    if (/find|evaluat|compute|what/i.test(text)) {
      steps.push({
        operation: "solve",
        expression: "{{prev}}",
        variable: "x",
      });
    }
    return steps.length > 1 ? steps : null;
  }

  // Pattern: define f(x) → compose f(f(x)) → solve f(f(x)) = k
  // e.g., "f(x) = √(x+1), find f(f(2))" or "f(f(x)) = 6, find x"
  if (/f\s*\(\s*f|compose|f\^2/i.test(text)) {
    const fDef = questionText.match(/f\s*\(\s*x\s*\)\s*=\s*([^,\n]+)/i);
    if (fDef) {
      steps.push({
        operation: "compose_functions",
        expression: fDef[1].trim(),
        variable: "x",
        params: { composition_depth: 2 },
      });
      if (/=.*\d|find.*x|solve/i.test(text)) {
        const target = text.match(/=\s*(\d+)/);
        if (target) {
          steps.push({
            operation: "solve",
            expression: "{{prev}}",
            variable: "x",
            params: { target_value: parseInt(target[1]) },
          });
        }
      }
      return steps.length > 1 ? steps : null;
    }
  }

  // Pattern: recurrence → closed form → evaluate at n
  if (/recurrence|a_\{?n.*\+.*1/i.test(text)) {
    const recMatch = questionText.match(/a_\{?n\s*\+\s*1\}?\s*=\s*([^,\n]+)/i);
    if (recMatch) {
      steps.push({
        operation: "recurrence_relation",
        expression: recMatch[1].trim(),
        variable: "n",
      });
      return steps;
    }
  }

  // Pattern: factorial limit with Stirling
  if (/factorial.*limit|n!.*limit|stirling|ⁿ√.*n!/i.test(text)) {
    steps.push({
      operation: "sequence_limit",
      expression: extractLatexBlocks(questionText)[0] || "",
      variable: "n",
      params: { point: "oo" },
    });
    return steps;
  }

  return null;
}

/**
 * Extract nested radical LaTeX from question text.
 */
function extractNestedRadicalLatex(text: string): string {
  const patterns = [
    /\\sqrt\s*\{?\s*(\d+)\s*\+?\s*\\sqrt\s*\{?\s*\1/,
    /√\s*\(\s*(\d+)\s*\+?\s*√\s*\(\s*\1/,
    /x\s*=\s*\\sqrt\s*\{([^}]+)\}/,
    /x\s*=\s*√\s*\(\s*([^)]+)\)/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[0];
  }
  return "";
}

/**
 * Extract function definition from question text.
 */
function extractFunctionDefinition(text: string): string | null {
  const patterns = [/f\s*\(\s*x\s*\)\s*=\s*([^,\n]+)/i, /f\s*:\s*x\s*\\mapsto\s*([^,\n]+)/i];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }
  return null;
}

/**
 * Extract recurrence relation from question text.
 */
function extractRecurrence(text: string): string {
  const patterns = [/a_\{?n\s*\+\s*1\}?\s*=\s*([^,\n]+)/i, /a_\(n\+1\)\s*=\s*([^,\n]+)/i];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }
  return "";
}
