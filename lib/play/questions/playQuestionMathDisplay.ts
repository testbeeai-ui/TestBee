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

const GREEK_CMD =
  "mu|lambda|tau|sigma|rho|theta|alpha|beta|gamma|delta|epsilon|varepsilon|omega|phi|varphi|psi|pi|chi|eta|iota|kappa|nu|xi|zeta|Delta|Gamma|Lambda|Omega|Phi|Pi|Psi|Sigma|Theta|Xi";

/** Wrap a single TeX command in `$...$` without shattering existing math. */
function wrapTexCommandInDollars(text: string): string {
  // Note: in JS replace strings, `$$` → literal `$`, and `$1` → capture group.
  return text.replace(
    new RegExp(`(?<![\\\\$])\\\\(${GREEK_CMD})(?![A-Za-z])`, "g"),
    "$$\\$1$$"
  );
}

/**
 * Unicode / bank physics notation → KaTeX-friendly `$...$` chunks.
 * Fixes Learning Outcomes stems like `2 μC` and Numerals options like `\frac{...}`.
 */
export function normalizePhysicsNotationForDisplay(text: string): string {
  let t = String(text ?? "");
  if (!t.trim()) return t;

  // Unicode micro + unit: 2 μC / μC → $2\,\mu\mathrm{C}$ / $\mu\mathrm{C}$
  t = t.replace(/(\d+(?:\.\d+)?)\s*[μµ]\s*([A-Za-z]+)/g, "$1 $\\mu\\mathrm{$2}$");
  t = t.replace(/[μµ]\s*([A-Za-z]+)/g, "$\\mu\\mathrm{$1}$");
  t = t.replace(/[μµ]/g, "$\\mu$");

  // Unit vector hats commonly pasted from Word: î ĵ k̂
  t = t.replace(/î/g, "$\\hat{\\imath}$");
  t = t.replace(/ĵ/g, "$\\hat{\\jmath}$");
  t = t.replace(/k̂/g, "$\\hat{k}$");

  // Scientific 10 with unicode superscripts: 10⁻⁴ / 10⁴ → $10^{-4}$
  const superMap: Record<string, string> = {
    "⁰": "0",
    "¹": "1",
    "²": "2",
    "³": "3",
    "⁴": "4",
    "⁵": "5",
    "⁶": "6",
    "⁷": "7",
    "⁸": "8",
    "⁹": "9",
    "⁺": "+",
    "⁻": "-",
  };
  t = t.replace(/10([⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]+)/g, (_m, supers: string) => {
    const tex = [...supers].map((c) => superMap[c] ?? c).join("");
    return `$10^{${tex}}$`;
  });

  // Trailing unicode superscripts on a unit letter: C⁻¹ → $\mathrm{C}^{-1}$
  t = t.replace(/\b([A-Za-z])([⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]+)/g, (_m, letter: string, supers: string) => {
    const tex = [...supers].map((c) => superMap[c] ?? c).join("");
    return `$\\mathrm{${letter}}^{${tex}}$`;
  });

  // Multiplication sign between numbers / math: × → $\times$
  t = t.replace(/×/g, " $\\times$ ");
  t = t.replace(/\s{2,}/g, " ").trim();

  // Already delimited (\(…\) / \[…\] / $…$) — never re-wrap greek/commands or the
  // whole string. Doing so shatters e.g. \( [0, 2\pi] \) into $[0, 2$\pi$]$.
  const trimmed = t.trim();
  if (/\\\(|\\\[|\$/.test(trimmed)) {
    return splitGluedGreekCommands(trimmed);
  }

  // ASCII latex already present but missing dollars (typical Numerals options)
  if (/\\[a-zA-Z]+/.test(trimmed)) {
    // Whole string is essentially a formula / short math option
    const proseWords = (trimmed.match(/[A-Za-z]{3,}/g) || []).filter(
      (w) =>
        !/^(frac|dfrac|tfrac|sqrt|times|cdot|left|right|mathrm|mathbf|text|hat|vec|infty|sin|cos|tan|log|ln|pm|mp|mu|pi|epsilon|theta|sigma|alpha|beta|gamma|delta|omega|phi|psi|lambda|rho|tau|imath|jmath)$/i.test(
          w
        )
    );
    if (proseWords.length <= 3 || /^\\(?:frac|dfrac|tfrac|sqrt)\b/.test(trimmed)) {
      return `$${splitGluedGreekCommands(trimmed)}$`;
    }
    // Mixed prose + latex fragments: wrap \frac{...}{...} and greek cmds
    t = trimmed.replace(/\\frac\{[^{}]+\}\{[^{}]+\}/g, (m) => `$${m}$`);
    t = wrapTexCommandInDollars(t);
    t = t.replace(/(?<![\\$])\\(times|cdot|pm|mp|infty)\b/g, "$$\\$1$$");
    return splitGluedGreekCommands(t);
  }

  return t;
}

function preprocessNakedMath(text: string): string {
  let t = normalizePhysicsNotationForDisplay(text);
  if (!t.trim()) return t;

  // Split glued letters after Greek commands (runs even inside math delimiters)
  t = splitGluedGreekCommands(t);

  // If already in math mode, do not re-wrap greek (avoids `$\mu$` → `$$\mu$$` / raw `\\mu$$`)
  if (/\\\(|\\\[|\$/.test(t)) {
    return t;
  }

  // Wrap LaTeX Greek commands in $...$ when outside math mode
  t = wrapTexCommandInDollars(t);

  // Wrap Greek letter names without backslash — never touch inside \$… or after \
  t = t.replace(
    new RegExp(`(?<![\\\\$])\\b(${GREEK_CMD.split("|").filter((x) => x === x.toLowerCase()).join("|")})\\b`, "gi"),
    (match) => `$\\${match.toLowerCase()}$`
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
    [/Theexpressionis/gi, "The expression is"],
    [/thenewquotientis/gi, "the new quotient is"],
    [/increasesbyafactorof(\d+)/gi, "increases by a factor of $1"],
    [/decreasesbyafactorof(\d+)/gi, "decreases by a factor of $1"],
    [/increasesby/gi, "increases by"],
    [/decreasesby/gi, "decreases by"],
    [/byafactorof/gi, "by a factor of"],
    [/factorof(\d+)/gi, "factor of $1"],
  ];
  for (const [re, rep] of gluedPhrases) {
    t = t.replace(re, rep);
  }
  return t;
}

/**
 * Curriculum banks sometimes wrap prose + math in a single `$...$`. KaTeX math mode strips spaces
 * (e.g. `$Q_cincreasesbyafactorof2$`). Split a leading `X_y` / `X_{y}` math atom from glued English.
 */
function tryDemoteGluedProseFromDollarInner(inner: string): string | null {
  const t = inner.trim();
  const m1 = t.match(/^([A-Za-z])_([a-z])((?:[a-z]){4,})$/);
  if (m1) {
    return `$${m1[1]}_{${m1[2]}}$ ${repairGluedWordsInString(m1[3]!)}`;
  }
  const m2 = t.match(/^([A-Za-z])_\{([A-Za-z]{1,3})\}([a-z][a-z]{3,})$/);
  if (m2 && /^[A-Za-z]+$/.test(m2[2]!)) {
    return `$${m2[1]}_{${m2[2]}}$ ${repairGluedWordsInString(m2[3]!)}`;
  }
  return null;
}

export function demoteInlineMathDollarSegments(text: string): string {
  return text.replace(/\$([^$\n]+)\$/g, (full, inner: string) => {
    const d = tryDemoteGluedProseFromDollarInner(String(inner).trim());
    return d ?? full;
  });
}

/** `Q_c`, `K_eq`, … in plain text → inline math so subscripts render. */
function wrapReactionQuotientPlainSubscripts(text: string): string {
  const t = text.trim();
  if (!t || /\$/.test(t)) return text;
  return t.replace(/\b([AQK])_(c|p|eq|new|old)\b/gi, (_m, a: string, s: string) => {
    return `$${a}_{${String(s).toLowerCase()}}$`;
  });
}

/** `[A]^2` concentration-style notation in plain text → inline KaTeX. */
function wrapChemBracketPowers(text: string): string {
  if (!text.includes("^") || /\$/.test(text)) return text;
  return text.replace(
    /\[\s*([A-Za-z])\s*\]\s*\^\s*\{?\s*(\d+)\s*\}?/g,
    (_m, el: string, pow: string) => `$[\\mathrm{${el}}]^{${pow}}$`
  );
}

/** Apply {@link repairGluedWordsInString} inside each `$...$` / `$$...$$` pair only. */
export function repairPlayQuestionDollarSegments(text: string): string {
  const pass0 = demoteInlineMathDollarSegments(text);
  return pass0
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
  let t = wrapReactionQuotientPlainSubscripts(s);
  t = wrapChemBracketPowers(t);
  // Bare ASCII area formulas from bank/LLM copy ("pir^2", "pi r^2") → KaTeX π r².
  // Lookbehind (?<![\\$]) is required: `\b` matches between `\` and `p` in `\pi`, so without
  // it we rewrite `\pi r^{2}` into `\$\pi r^{2}$` and shatter surrounding $…$ pairs.
  t = t.replace(/(?<![\\$])\bA\s*=\s*pi\s*r\s*\^\s*\{?\s*2\s*\}?/gi, "A = $\\pi r^{2}$");
  t = t.replace(/(?<![\\$])\bpir\s*\^\s*\{?\s*2\s*\}?/gi, "$\\pi r^{2}$");
  t = t.replace(/(?<![\\$])\bpi\s+r\s*\^\s*\{?\s*2\s*\}?/gi, "$\\pi r^{2}$");
  t = t.replace(/(?<![\\$])\bpir\b/gi, "$\\pi r$");
  t = t.replace(/(?<![\\$])\bpi\b(?![a-z])/gi, "$\\pi$");
  // Repair prior bad rewrites that left `\$\pi` (backslash + dollar + \pi).
  t = t.replace(/\\\$\\pi\b/g, "\\pi");
  const withNakedMath = preprocessNakedMath(t);
  return repairPlayQuestionDollarSegments(
    unwrapNestedInlineMathInPowers(unicodePowToTeX(withNakedMath))
  );
}
