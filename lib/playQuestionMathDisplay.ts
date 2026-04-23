/**
 * Play / adaptive question stems sometimes arrive with prose jammed inside `$...$`
 * or with spaces stripped (KaTeX math mode collapses spaces → unreadable).
 * Repair before MathText so chunks parse and prose heuristics work.
 */

/**
 * Detect and wrap naked math notation (Greek letters, LaTeX commands) in math delimiters.
 * This prevents KaTeX from showing red errors for things like \mu, \lambda, etc.
 */
/** Map LaTeX Greek commands -> Unicode so they work inside \text{...} (text mode). */
const GREEK_TO_UNICODE: Record<string, string> = {
  alpha: "α",
  beta: "β",
  gamma: "γ",
  delta: "δ",
  epsilon: "ε",
  varepsilon: "ε",
  zeta: "ζ",
  eta: "η",
  theta: "θ",
  iota: "ι",
  kappa: "κ",
  lambda: "λ",
  mu: "μ",
  nu: "ν",
  xi: "ξ",
  pi: "π",
  rho: "ρ",
  sigma: "σ",
  tau: "τ",
  phi: "φ",
  varphi: "φ",
  chi: "χ",
  psi: "ψ",
  omega: "ω",
  Delta: "Δ",
  Gamma: "Γ",
  Lambda: "Λ",
  Omega: "Ω",
  Phi: "Φ",
  Pi: "Π",
  Psi: "Ψ",
  Sigma: "Σ",
  Theta: "Θ",
  Xi: "Ξ",
};

/**
 * Replace Greek LaTeX commands (e.g. \mu) that appear INSIDE \text{...} blocks
 * with Unicode equivalents. KaTeX's text mode does not recognize \mu and renders
 * it as a red error — unicode characters work fine in text mode.
 */
export function fixGreekInsideTextBlocks(text: string): string {
  return text.replace(/\\text\{([^{}]*)\}/g, (_match, inner: string) => {
    const fixed = inner.replace(
      /\\(mu|lambda|tau|sigma|rho|theta|alpha|beta|gamma|delta|epsilon|varepsilon|omega|phi|varphi|psi|pi|chi|eta|iota|kappa|nu|xi|zeta|Delta|Gamma|Lambda|Omega|Phi|Pi|Psi|Sigma|Theta|Xi)\s?/g,
      (_m, name: string) => GREEK_TO_UNICODE[name] ?? _m
    );
    return `\\text{${fixed}}`;
  });
}

/**
 * Split glued letters after Greek commands: "\muC" -> "\mu{}C".
 * KaTeX would otherwise treat \muC as one unknown command.
 */
export function splitGluedGreekCommands(text: string): string {
  return text.replace(
    /\\(mu|lambda|tau|sigma|rho|theta|alpha|beta|gamma|delta|epsilon|varepsilon|omega|phi|varphi|psi|pi|chi|eta|iota|kappa|nu|xi|zeta|Delta|Gamma|Lambda|Omega|Phi|Pi|Psi|Sigma|Theta|Xi)([A-Za-z])/g,
    "\\$1{}$2"
  );
}

function preprocessNakedMath(text: string): string {
  let t = text;
  if (!t.trim()) return t;

  // Handle unicode mu character (μ) directly
  t = t.replace(/μ/g, "\\mu ");

  // Split glued letters after Greek commands (runs even inside math delimiters)
  t = splitGluedGreekCommands(t);

  // If already in math mode, done (splitting was enough)
  if (/\\\(|\\\[|\$\$?/.test(t)) return t;

  // Wrap LaTeX Greek commands in $...$ when outside math mode
  // Note: $$ in replacement string = literal $
  t = t.replace(
    /\\(mu|lambda|tau|sigma|rho|theta|alpha|beta|gamma|delta|epsilon|varepsilon|omega|phi|varphi|psi|pi|chi|eta|iota|kappa|nu|xi|zeta|Delta|Gamma|Lambda|Omega|Phi|Pi|Psi|Sigma|Theta|Xi)/g,
    "$$\\$1$$"
  );

  // Wrap Greek letter names without backslash (common in plain text)
  t = t.replace(
    /\b(tau|sigma|rho|theta|alpha|beta|gamma|delta|epsilon|omega|phi|psi|lambda|mu)\b/gi,
    "$$\\$1$$"
  );

  return t;
}

/** Long run of letters without spaces — likely glued English inside bad LaTeX. */
function hasGluedEnglishRun(s: string, minLen = 8): boolean {
  return new RegExp(`[a-zA-Z]{${minLen},}`).test(s);
}

/**
 * Insert missing spaces so word boundaries exist for prose detection and reading.
 * Safe for typical numeric/math tails (digit-letter, punctuation-letter, camelCase).
 */
export function repairGluedWordsInString(s: string): string {
  let t = s;
  let prev = "";
  while (prev !== t) {
    prev = t;
    t = t.replace(/([0-9])([a-zA-Z])/g, "$1 $2");
    t = t.replace(/([\)\]\}])([a-zA-Z])/g, "$1 $2");
    t = t.replace(/([.?!])([A-Za-z])/g, "$1 $2");
    t = t.replace(/([,;:])\s*([A-Za-z])/g, "$1 $2");
    t = t.replace(/([a-z])([A-Z])/g, "$1 $2");
  }
  const gluedPhrases: [RegExp, string][] = [
    [/Whatistheslope/gi, "What is the slope"],
    [/Whatis/gi, "What is"],
    [/Wheredoes/gi, "Where does"],
    [/Howmany/gi, "How many"],
    [/Findthe/gi, "Find the"],
    [/Evaluatethe/gi, "Evaluate the"],
    [/hasslope/gi, "has slope"],
    [/thenormal/gi, "the normal"],
    [/atthatpoint/gi, "at that point"],
    [/slopeofthe/gi, "slope of the"],
    [/ofthenormal/gi, "of the normal"],
    [/negative reciprocal/gi, "negative reciprocal"],
  ];
  for (const [re, rep] of gluedPhrases) {
    t = t.replace(re, rep);
  }
  return t;
}

/** Apply {@link repairGluedWordsInString} inside each `$...$` / `$$...$$` pair only. */
export function repairPlayQuestionDollarSegments(text: string): string {
  return text
    .replace(/\$\$([^$]+)\$\$/g, (_, inner: string) => {
      const x = repairGluedWordsInString(String(inner));
      return `$$${x}$$`;
    })
    .replace(/\$([^$\n]+?)\$/g, (_, inner: string) => {
      const x = repairGluedWordsInString(String(inner));
      return `$${x}$`;
    });
}

/**
 * Unicode superscripts on variables (e.g. x³) → TeX x^{3} when the stem has no `$`
 * so MathText can render a small inline formula instead of mis-detecting chunks.
 */
export function unicodePowToTeX(text: string): string {
  if (/\$|\\\(|\\\[/.test(text)) return text;
  const map: Record<string, string> = {
    "⁰": "^{0}",
    "¹": "^{1}",
    "²": "^{2}",
    "³": "^{3}",
    "⁴": "^{4}",
    "⁵": "^{5}",
    "⁶": "^{6}",
    "⁷": "^{7}",
    "⁸": "^{8}",
    "⁹": "^{9}",
  };
  let t = text;
  for (const [u, te] of Object.entries(map)) {
    t = t.replace(new RegExp(`([A-Za-z])${u}`, "g"), `$1${te}`);
  }
  t = t.replace(/\u2212/g, "-");
  return t;
}

/**
 * Some banks send nested inline delimiters inside exponent blocks, e.g.
 * `e^{\\(i\\pi\\)} + 1 = 0`. This confuses the markdown->KaTeX pipeline because
 * `\\(...\\)` later becomes `$...$` and gets embedded inside braces.
 * Strip only this nesting so the expression remains valid TeX/plain math.
 */
export function unwrapNestedInlineMathInPowers(text: string): string {
  let t = text;
  // e^{\(i\pi\)} -> e^{i\pi}
  t = t.replace(/\^\{\\\(([\s\S]*?)\\\)\}/g, "^{$1}");
  // e^\(i\pi\) -> e^{i\pi}
  t = t.replace(/\^\\\(([\s\S]*?)\\\)/g, "^{$1}");
  // {( ... )} wrappers that sometimes appear around Euler-like exponent content
  t = t.replace(/\^\{\(([^{}]+)\)\}/g, "^{$1}");
  return t;
}

/** Full pipeline for stems shown in PlayQuestionCard / InlineRdmChallenge. */
export function formatPlayQuestionStemForDisplay(text: string): string {
  const s = String(text ?? "").trim();
  if (!s) return s;
  const withNakedMath = preprocessNakedMath(s);
  return repairPlayQuestionDollarSegments(
    unwrapNestedInlineMathInPowers(unicodePowToTeX(withNakedMath))
  );
}
