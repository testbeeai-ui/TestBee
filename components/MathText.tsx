"use client";

import React from "react";
import katex from "katex";

/** Preprocess curriculum-style formula text to valid LaTeX. */
function toLatex(text: string): string {
  let s = text;
  // Bad generator typo: \uparrowrac → \frac (e.g. Curie–Weiss χ = C/(T − T_C))
  s = s.replace(/\\uparrowrac\b/g, "\\frac");
  // Broader arrow-variant typos seen in some payloads: ↑rac, ⬆rac, \uarrac, \arrowrac.
  s = s.replace(/(?:\\uarrac|\\arrowrac)\b/g, "\\frac");
  s = s.replace(/(?:\\(?:up)?arrow|[↑⇑⬆⭡⇧↟])\s*rac\b/g, "\\frac");
  // Last-resort recovery for malformed "\frac" prefixes such as "\xrac", "\yrac", "^rac", "rac".
  s = s.replace(/\\[A-Za-z^]*rac(?=\s*\{)/g, "\\frac");
  s = s.replace(/(^|[=\s(])(?:\^|[↑⇑⬆⭡⇧↟])?\s*rac(?=\s*\{)/g, "$1\\frac");
  // Bad generator output: "A = \{\pi}" / "{ \pi }" — KaTeX error (red); normalize to \pi
  s = s.replace(/\\\{\s*\\pi\s*\}/g, "\\pi");
  s = s.replace(/\{\s*\\pi\s*\}/g, "\\pi");
  // Common API payload artifact: escaped backslashes arrive doubled.
  s = s.replace(/\\\\([A-Za-z()[\]{}])/g, "\\$1");
  s = s.replace(/piepsilon_0/g, "\\pi\\varepsilon_0");
  s = s.replace(/piepsilon/g, "\\pi\\varepsilon");
  s = s.replace(/\blambda\b/g, "\\lambda");
  s = s.replace(/(\d)\s+x\s+(\d)/g, "$1 \\times $2");
  s = s.replace(/([A-Za-z])_1_2\b/g, "$1_{12}");
  // Curriculum: integral_a^b |f(x)| dx -> proper definite integral
  s = s.replace(/\bintegral_\{([^}]+)\}\^\{([^}]+)\}/gi, "\\int_{$1}^{$2}");
  s = s.replace(/\bintegral_([a-zA-Z0-9]+)\^([a-zA-Z0-9]+)\b/g, "\\int_{$1}^{$2}");
  s = s.replace(/\bintegral_([a-zA-Z])\s*\^\s*([a-zA-Z])\b/g, "\\int_{$1}^{$2}");
  s = s.replace(/\bpi\s*r\b/gi, "\\pi r");
  s = s.replace(/\bpir\b/gi, "\\pi r");
  s = s.replace(/\bgeq\b/gi, "\\geq");
  s = s.replace(/\bleq\b/gi, "\\leq");
  // Strip full-wrapper delimiters if present.
  s = s.replace(/^\\\(([\s\S]*)\\\)$/, "$1");
  s = s.replace(/^\\\[([\s\S]*)\\\]$/, "$1");
  s = s.replace(/^\$\$([\s\S]*)\$\$$/, "$1");
  s = s.replace(/^\$([\s\S]*)\$$/, "$1");
  return s;
}

/**
 * "A = ..." tail only (after last ": " that starts an area formula).
 * Splits trailing prose like "where f(x) >= g(x)" out for plain-text rendering.
 */
function splitFormulaAtWhere(formula: string): { eq: string; prose: string } {
  const m = formula.trim().match(/^(.+?)(\s+where\s+[\s\S]+)$/i);
  if (m) {
    return { eq: m[1]!.trim(), prose: m[2]!.trim() };
  }
  return { eq: formula.trim(), prose: "" };
}

/**
 * Long titles like "… from x=a to x=b: A = integral_a^b |f(x)| dx" must not be
 * fed entirely to KaTeX (math mode collapses spaces → "f(x)andx").
 * Split on the last ":" before "A = …".
 */
function splitDescriptionAndAreaFormula(text: string): { head: string; formula: string } | null {
  const t = text.trim();
  for (let i = t.length - 1; i >= 0; i--) {
    if (t[i] !== ":") continue;
    const tail = t.slice(i + 1).trim();
    if (/^A\s*=/i.test(tail)) {
      const head = t.slice(0, i).trim();
      if (head.length >= 3) {
        return { head, formula: tail };
      }
    }
  }
  return null;
}

function wordTokenCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function hasExistingMathDelimiters(text: string): boolean {
  return /\\\(|\\\[|\$\$/.test(text) || /\$(?!\s)/.test(text);
}

/**
 * Wrap naked LaTeX / unit-style math in prose so splitIntoMathChunks can render inline
 * (avoids whole-string KaTeX that collapses spaces and causes horizontal scroll).
 */
function preprocessNakedMath(text: string): string {
  const t = text;
  if (!t.trim()) return t;
  if (hasExistingMathDelimiters(t)) return t;

  const wc = wordTokenCount(t);
  const proseHeavy = wc > 5 || t.length > 70;
  if (!proseHeavy) return t;

  const hasNaked =
    /\\[a-zA-Z]{2,}\b/.test(t) ||
    /\b(tau|sigma|rho|theta|alpha|beta|gamma|delta|epsilon|omega|phi|psi|lambda)\b/i.test(t) ||
    /\b[a-z]\^(\d+)\b/i.test(t);
  if (!hasNaked) return t;

  /** Count whether we're inside an odd number of \( ... \) pairs opened so far (rough delimiter depth). */
  const delimiterDepthAt = (before: string): number => {
    let depth = 0;
    const re = /\\\(|\\\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(before)) !== null) {
      if (m[0] === "\\(") depth++;
      else depth = Math.max(0, depth - 1);
    }
    return depth;
  };

  let s = t;

  const greekWordToTex: Record<string, string> = {
    tau: "\\tau",
    sigma: "\\sigma",
    rho: "\\rho",
    theta: "\\theta",
    alpha: "\\alpha",
    beta: "\\beta",
    gamma: "\\gamma",
    delta: "\\delta",
    epsilon: "\\varepsilon",
    omega: "\\omega",
    phi: "\\phi",
    psi: "\\psi",
    lambda: "\\lambda",
  };
  for (const [word, tex] of Object.entries(greekWordToTex)) {
    const re = new RegExp(`\\b${word}\\b`, "gi");
    s = s.replace(re, (match, offset) => {
      if (delimiterDepthAt(s.slice(0, offset)) > 0) return match;
      return `\\(${tex}\\)`;
    });
  }

  // Common prose exponents: x^2, m^2 (single letter + digit)
  s = s.replace(/\b([a-z])\^(\d+)\b/gi, (match, _a, _n, offset) => {
    if (delimiterDepthAt(s.slice(0, offset)) > 0) return match;
    return `\\(${match}\\)`;
  });

  const skipNakedWrap = new Set([
    "text",
    "mathrm",
    "mathbf",
    "mathit",
    "mathcal",
    "mathbb",
    "mathfrak",
    "frac",
    "sqrt",
    "sum",
    "prod",
    "lim",
    "int",
    "left",
    "right",
    "middle",
    "begin",
    "end",
    "hline",
    "dots",
    "cdots",
    "ldots",
    "vdots",
    "ddots",
    "big",
    "Big",
    "bigg",
    "Bigg",
  ]);

  s = s.replace(/\\([a-zA-Z]+)/g, (match, cmd: string, offset) => {
    if (delimiterDepthAt(s.slice(0, offset)) > 0) return match;
    if (skipNakedWrap.has(cmd.toLowerCase())) return match;
    return `\\(${match}\\)`;
  });

  return s;
}

/**
 * True when the string is predominantly a TeX expression (short or formula-like), not long English
 * prose with an occasional \\mu — whole-string KaTeX is appropriate only for the former.
 */
function looksLikeRawTexExpression(text: string): boolean {
  const t = text.trim();
  if (!/\\[a-zA-Z]/.test(t)) return false;
  const wc = wordTokenCount(t);
  if (wc > 14) return false;
  if (
    wc > 8 &&
    /\b(the|a|an|is|are|was|were|what|which|when|where|how|why|and|or|but|if|then|from|this|that|these|those|for|with|wire|length|charge|uniform|straight|carries|total|distribution|linear|surface|volume)\b/i.test(
      t,
    )
  ) {
    return false;
  }
  return true;
}

/**
 * "Standard areas: circle …; parabola …" — one long curriculum line → stacked
 * labeled rows with KaTeX (avoids a single crushed heading).
 */
/**
 * "Empty relation: … ; R = phi subset of A x A" — prose line + set-theory formula line (KaTeX).
 * Curriculum often spells ∅/⊆/× as words; second image shows R = ∅ ⊆ A × A on its own line.
 */
function splitProseSemicolonRelationEq(text: string): { prose: string; formulaRaw: string } | null {
  const t = text.trim();
  const semi = t.match(/^([\s\S]+?);\s*([Rr])\s*=\s*([\s\S]+)$/i);
  if (semi) {
    const prose = semi[1]!.trim();
    const tail = semi[3]!.trim();
    if (prose.length >= 8 && tail.length >= 2) return { prose, formulaRaw: `R = ${tail}` };
  }
  if (/\brelation\b/i.test(t)) {
    const rel = t.match(/\b([Rr])\s*=\s*([\s\S]+)$/i);
    if (rel && rel.index != null && rel.index >= 12) {
      const prose = t
        .slice(0, rel.index)
        .trim()
        .replace(/\s+$/g, "")
        .replace(/\s*;\s*$/, "");
      const tail = rel[2]!.trim();
      if (prose.length >= 8 && tail.length >= 2) return { prose, formulaRaw: `R = ${tail}` };
    }
  }
  return null;
}

/**
 * "Reflexive relation: (a, a) in R for every a in A" → label + KaTeX definition
 * (curriculum uses plain "in"; we render ∈, tuple spacing, and canonical clause order).
 */
function normalizeRelationTitleBody(s: string): string {
  return s
    .trim()
    .replace(/\u2208/g, " in ")
    .replace(/\s+/g, " ")
    .replace(/\s*\.\s*$/, "");
}

function parseReflexiveDefinition(body: string): string | null {
  const b = normalizeRelationTitleBody(body);
  const p1 = b.match(
    /^\(\s*([a-z])\s*,\s*\1\s*\)\s+in\s+([A-Za-z])\s+for\s+every\s+\1\s+in\s+([A-Za-z])$/i,
  );
  if (p1) {
    const v = p1[1]!;
    const R = p1[2]!;
    const A = p1[3]!;
    return `\\text{for every } ${v} \\in ${A}\\text{, } (${v},\\,${v}) \\in ${R}\\text{.}`;
  }
  const p2 = b.match(
    /^for\s+every\s+([a-z])\s+in\s+([A-Za-z])\s*,\s*\(\s*\1\s*,\s*\1\s*\)\s+in\s+([A-Za-z])$/i,
  );
  if (p2) {
    const v = p2[1]!;
    const A = p2[2]!;
    const R = p2[3]!;
    return `\\text{for every } ${v} \\in ${A}\\text{, } (${v},\\,${v}) \\in ${R}\\text{.}`;
  }
  return null;
}

function parseSymmetricDefinition(body: string): string | null {
  const b = normalizeRelationTitleBody(body);
  const m = b.match(
    /^\(\s*([a-z])\s*,\s*([a-z])\s*\)\s+in\s+([A-Za-z])\s+(?:implies|⇒|->|=>)\s+\(\s*\2\s*,\s*\1\s*\)\s+in\s+\3$/i,
  );
  if (!m) return null;
  const a = m[1]!;
  const bVar = m[2]!;
  const R = m[3]!;
  return `(${a},\\,${bVar}) \\in ${R} \\Rightarrow (${bVar},\\,${a}) \\in ${R}\\text{.}`;
}

function parseTransitiveDefinition(body: string): string | null {
  const b = normalizeRelationTitleBody(body);
  const m = b.match(
    /^\(\s*([a-z])\s*,\s*([a-z])\s*\)\s+in\s+([A-Za-z])\s+and\s+\(\s*\2\s*,\s*([a-z])\s*\)\s+in\s+\3\s+(?:implies|⇒|->|=>)\s+\(\s*\1\s*,\s*\4\s*\)\s+in\s+\3$/i,
  );
  if (!m) return null;
  const a = m[1]!;
  const bVar = m[2]!;
  const R = m[3]!;
  const c = m[4]!;
  return `(${a},\\,${bVar}) \\in ${R}\\text{ and } (${bVar},\\,${c}) \\in ${R} \\Rightarrow (${a},\\,${c}) \\in ${R}\\text{.}`;
}

/**
 * Curriculum: "Equivalence class [a]: all elements b such that (a,b) in R; classes partition the set"
 * Reference: "Equivalence class [a]: the set of all elements b ∈ A such that (a, b) ∈ R; … partition … A."
 * Two LaTeX lines: short head + definition (fits layout without horizontal scroll).
 */
function parseEquivalenceClassCurriculumParts(
  raw: string,
): { prefixLatex: string; suffixLatex: string } | null {
  const n = raw
    .replace(/\$\s*\[([^\]]+)\]\s*\$/g, "[$1]")
    .replace(/\s+/g, " ")
    .trim();
  const head = n.match(/^Equivalence\s+class\s+\[\s*([^\]]+?)\s*\]\s*:\s*(.+)$/i);
  if (!head) return null;
  const rep = head[1]!.trim();
  if (!/^[A-Za-z][A-Za-z0-9']*$/i.test(rep)) return null;
  const body = head[2]!.trim().replace(/\.\s*$/, "");
  const m = body.match(
    /^all\s+elements\s+([a-z])\s+such\s+that\s+\(\s*([a-z])\s*,\s*([a-z])\s*\)\s+(?:in|∈)\s+([A-Za-z])\s*;\s*(.+)$/i,
  );
  if (!m) return null;
  const bEl = m[1]!;
  const aT = m[2]!;
  const bT = m[3]!;
  const R = m[4]!;
  const tail = m[5]!.trim().replace(/\.\s*$/, "");
  const tl = tail.toLowerCase();
  let second: string;
  if (
    tl === "classes partition the set" ||
    tl === "the classes partition the set" ||
    tl === "equivalence classes partition the set"
  ) {
    second = "\\text{; equivalence classes partition the set } A\\text{.}";
  } else {
    const part = tail.replace(/([%#&_{}])/g, " ");
    second = `\\text{; ${part}}\\text{.}`;
  }
  const prefixLatex = `\\text{Equivalence class }[${rep}]\\text{:}`;
  const suffixLatex = `\\text{the set of all elements } ${bEl} \\in A\\text{ such that } (${aT},\\,${bT}) \\in ${R}${second}`;
  return { prefixLatex, suffixLatex };
}

/**
 * Curriculum: "Injective (one-to-one): f(a1) = f(a2) implies a1 = a2; or a1 != a2 implies f(a1) != f(a2)"
 * Reference: two lines with a₁,a₂ ∈ A, ⇒, ≠, "equivalently".
 */
function parseInjectiveFunctionTitleParts(raw: string): { line1: string; line2: string } | null {
  const n = raw.replace(/\s+/g, " ").trim();
  const hm = n.match(
    /^Injective\s+\(\s*(?:one\s*-\s*to\s*-\s*one|one-to-one)\s*\)\s*:\s*(.+)$/i,
  );
  if (!hm) return null;
  const rest = hm[1]!
    .trim()
    .replace(/\.\s*$/, "")
    .replace(/!\s*=\s*/g, " != ")
    .replace(/\s+/g, " ");
  const m = rest.match(
    /^f\s*\(\s*([a-z])\s*1\s*\)\s*=\s*f\s*\(\s*\1\s*2\s*\)\s+(?:implies|⇒)\s+\1\s*1\s*=\s*\1\s*2\s*;\s*or\s+\1\s*1\s*(?:!=|≠)\s+\1\s*2\s+(?:implies|⇒)\s+f\s*\(\s*\1\s*1\s*\)\s*(?:!=|≠)\s+f\s*\(\s*\1\s*2\s*\)\s*$/i,
  );
  if (!m) return null;
  const v = m[1]!;
  const line1 = `\\text{Injective (one-to-one): for all } ${v}_{1}, ${v}_{2} \\in A\\text{, } f(${v}_{1}) = f(${v}_{2}) \\Rightarrow`;
  const line2 = `${v}_{1} = ${v}_{2}\\text{; equivalently, } ${v}_{1} \\neq ${v}_{2} \\Rightarrow f(${v}_{1}) \\neq f(${v}_{2})\\text{.}`;
  return { line1, line2 };
}

/**
 * Curriculum: "Surjective (onto): for every b in codomain, there exists a in domain such that f(a) = b"
 */
function parseSurjectiveFunctionTitleParts(raw: string): { line1: string; line2: string } | null {
  const n = raw.replace(/\s+/g, " ").trim();
  const hm = n.match(/^Surjective\s+\(\s*onto\s*\)\s*:\s*(.+)$/i);
  if (!hm) return null;
  const rest = hm[1]!.trim().replace(/\.\s*$/, "");
  const m = rest.match(
    /^for\s+every\s+([a-z])\s+in\s+codomain\s*,\s*there\s+exists\s+([a-z])\s+in\s+domain\s+such\s+that\s+f\s*\(\s*\2\s*\)\s*=\s*\1\s*$/i,
  );
  if (!m) return null;
  const bVar = m[1]!;
  const aVar = m[2]!;
  const line1 = `\\text{Surjective (onto):}`;
  const line2 = `\\text{for every } ${bVar} \\in \\mathrm{codomain}\\text{, there exists } ${aVar} \\in \\mathrm{domain} \\text{ such that } f(${aVar}) = ${bVar}\\text{.}`;
  return { line1, line2 };
}

/** Curriculum: "Bijective: both injective and surjective; inverse function exists" */
function parseBijectiveFunctionTitleLatex(raw: string): string | null {
  const n = raw.replace(/\s+/g, " ").trim();
  if (!/^Bijective\s*:/i.test(n)) return null;
  const body = n.replace(/^Bijective\s*:\s*/i, "").trim().replace(/\.\s*$/, "");
  if (!/^both\s+injective\s+and\s+surjective\s*;\s*inverse\s+function\s+exists$/i.test(body)) return null;
  return "\\text{Bijective: both injective and surjective; inverse function exists.}";
}

function rangePieceToLatex(s: string): string {
  let t = s.trim();
  t = t.replace(/\u03C0/g, "\\pi");
  t = t.replace(/\bpi\b/gi, "\\pi");
  t = t.replace(/-\s*\\pi\s*\/\s*2/gi, "-\\pi/2");
  t = t.replace(/\\pi\s*\/\s*2/gi, "\\pi/2");
  t = t.replace(/\[\s*/g, "[");
  t = t.replace(/\s*\]/g, "]");
  t = t.replace(/\(\s*/g, "(");
  t = t.replace(/\s*\)/g, ")");
  t = t.replace(/\s*,\s*/g, ", ");
  return t;
}

/** "sin^-1x: domain [-1, 1]; range [-pi/2, pi/2] (principal value branch)" */
function parseInverseTrigDomainRangeTitle(raw: string): string | null {
  const n = raw.replace(/\s+/g, " ").trim().replace(/\.\s*$/, "");
  const m = n.match(
    /^(sin|cos|tan|cosec|sec|cot)\s*\^\s*-?\s*1\s*x\s*:\s*domain\s+(.+?)\s*;\s*range\s+(.+?)(?:\s*\(([^)]+)\))?$/i,
  );
  if (!m) return null;
  const fn = m[1]!.toLowerCase();
  const domain = rangePieceToLatex(m[2]!);
  const range = rangePieceToLatex(m[3]!);
  const note = m[4]?.trim();
  const fnLatex = `\\${fn}^{-1}x`;
  const noteLatex = note ? `\\ (\\text{${note.replace(/([%#&_{}])/g, " ")}})` : "";
  return `${fnLatex}\\;\\text{: domain }${domain}\\text{; range }${range}${noteLatex}\\text{.}`;
}

/** "A^-1 = adj(A)/|A| (valid only if |A| != 0; A is non-singular)" */
function parseAdjointInverseFormulaTitle(raw: string): string | null {
  let n = raw.replace(/\s+/g, " ").trim().replace(/\.\s*$/, "");
  n = n.replace(/!\s*=\s*/g, "!=");
  // prettifySubtopicTitle turns hyphens into " - " (e.g. non - singular)
  n = n.replace(/\bnon\s*-\s*singular\b/gi, "non-singular");
  const strict = n.match(
    /^A\s*\^\s*-?\s*1\s*=\s*adj\s*\(\s*A\s*\)\s*\/\s*\|\s*A\s*\|\s*\(\s*valid\s+only\s+if\s*\|\s*A\s*\|\s*(?:!=|≠)\s*0\s*;\s*A\s+is\s+non-singular\s*\)\s*$/i,
  );
  const loose =
    !strict &&
    /^A\s*\^/i.test(n) &&
    /adj\s*\(\s*A\s*\)/i.test(n) &&
    /\/\s*\|\s*A\s*\|/i.test(n) &&
    /valid\s+only\s+if/i.test(n) &&
    /\|\s*A\s*\|\s*(?:!=|≠)\s*0/i.test(n) &&
    /\bA\s+is\s+non/i.test(n);
  if (!strict && !loose) return null;
  return "A^{-1} = \\dfrac{\\operatorname{adj}(A)}{|A|}\\ \\text{if } |A| \\neq 0\\ (\\text{i.e. } A\\ \\text{is non-singular})\\text{.}";
}

/**
 * Curriculum: "Adjoint: adj(A) = transpose of cofactor matrix; A.adj(A) = |A|.I"
 * Display: Adjoint of A :  adj(A) = (cofactor matrix of A)^T
 */
function parseAdjointCofactorTransposeTitle(raw: string): string | null {
  const n = raw.replace(/\s+/g, " ").trim().replace(/\.\s*$/, "");
  const strict = n.match(
    /^Adjoint\s*:\s*adj\s*\(\s*A\s*\)\s*=\s*transpose\s+of\s+cofactor\s+matrix\s*;\s*A\s*\.\s*adj\s*\(\s*A\s*\)\s*=\s*\|\s*A\s*\|\s*\.\s*I\s*$/i,
  );
  const loose =
    !strict &&
    /^Adjoint\s*:/i.test(n) &&
    /adj\s*\(\s*A\s*\)/i.test(n) &&
    /transpose\s+of\s+cofactor\s+matrix/i.test(n) &&
    /\|\s*A\s*\|/i.test(n) &&
    /\bA\s*\.\s*adj\s*\(/i.test(n);
  if (!strict && !loose) return null;
  return "\\text{Adjoint of } A \\,\\text{:}\\quad \\operatorname{adj}(A) = (\\text{cofactor matrix of } A)^{\\mathrm{T}}";
}

/**
 * Curriculum: "Minor Mij: det of matrix obtained by deleting row i and col j"
 * Display: Minor M_{ij} of an n×n matrix A is M_{ij} = det(A_{ij}),
 */
function parseMinorMijDefinitionTitle(raw: string): string | null {
  const n = raw.replace(/\s+/g, " ").trim().replace(/\.\s*$/, "");
  const strict = n.match(
    /^Minor\s+Mij\s*:\s*det\s+of\s+matrix\s+obtained\s+by\s+deleting\s+row\s+i\s+and\s+col\s+j\s*$/i,
  );
  const loose =
    !strict &&
    /^Minor\s+Mij\s*:/i.test(n) &&
    /\brow\s+i\b/i.test(n) &&
    /\bcol\s+j\b/i.test(n);
  if (!strict && !loose) return null;
  return "\\text{Minor } M_{ij} \\text{ of an } n \\times n \\text{ matrix } A \\text{ is } M_{ij} = \\det(A_{ij})\\text{,}";
}

/** Curriculum: "Cofactor Cij = (-1)^(i+j) Mij" (prettify may add spaces around - and +) */
function parseCofactorCijTitle(raw: string): string | null {
  const n = raw.replace(/\s+/g, " ").trim().replace(/\.\s*$/, "");
  const strict = n.match(
    /^Cofactor\s+Cij\s*=\s*\(\s*-?\s*1\s*\)\s*\^\s*\(\s*i\s*\+\s*j\s*\)\s*Mij\s*$/i,
  );
  const loose =
    !strict &&
    /^Cofactor\s+Cij\s*=/i.test(n) &&
    /\(\s*-?\s*1\s*\)/i.test(n) &&
    /\^\s*\(\s*i/i.test(n) &&
    /Mij\s*$/i.test(n);
  if (!strict && !loose) return null;
  return "\\text{Cofactor } C_{ij} = (-1)^{i+j} M_{ij}";
}

/**
 * Curriculum: "Using elementary row operations to find A^-1: write [A|I] and reduce to [I|A^-1]"
 * prettifySubtopicTitle may rewrite exponents as "A^ - 1".
 */
function parseElementaryRowOpsInverseTitle(raw: string): string | null {
  let n = raw.replace(/\s+/g, " ").trim().replace(/\.\s*$/, "");
  n = n.replace(/\^\s*-\s*1/g, "^-1");
  const strict = n.match(
    /^Using elementary row operations to find A\^-1:\s*write\s+\[A\|I\]\s+and reduce to\s+\[I\|A\^-1\]$/i,
  );
  const loose =
    !strict &&
    /^Using elementary row operations to find/i.test(n) &&
    /\bA\^-1\s*:/i.test(n) &&
    /\[A\s*\|\s*I\]/i.test(n) &&
    /reduce\s+to/i.test(n) &&
    /\[I\s*\|\s*A/i.test(n);
  if (!strict && !loose) return null;
  // Two lines so the heading fits column width without a horizontal scrollbar.
  return (
    "\\begin{array}{l}" +
    "\\text{Using elementary row operations to find } A^{-1} \\text{ : write } \\left[ A \\middle| I \\right] \\\\" +
    "\\text{and reduce to } \\left[ I \\middle| A^{-1} \\right]\\text{.}" +
    "\\end{array}"
  );
}

/**
 * Curriculum: "Types: row matrix (1 x n), column (m x 1), square (m=n), zero/null, identity I (aij = deltaij), diagonal, scalar"
 * Display: proper ×, m = n, I(a_{ij} = δ_{ij}) (prettify may use × and spaces around =).
 */
function parseMatrixTypesCatalogTitle(raw: string): string | null {
  const n = raw.replace(/\s+/g, " ").trim().replace(/\.\s*$/, "");
  if (!/^Types:\s*row\s+matrix/i.test(n)) return null;
  if (!/row\s+matrix\s*\(\s*1\s*[x×]\s*n\s*\)/i.test(n)) return null;
  if (!/column\s*\(\s*m\s*[x×]\s*1\s*\)/i.test(n)) return null;
  if (!/square\s*\(\s*m\s*=\s*n\s*\)/i.test(n)) return null;
  if (!/zero\/null/i.test(n)) return null;
  if (!/identity\s+I\s*\(\s*aij\s*=\s*deltaij\s*\)/i.test(n)) return null;
  if (!/diagonal\s*,\s*scalar$/i.test(n)) return null;
  return (
    "\\begin{array}{l}" +
    "\\text{Types: row matrix }(1 \\times n)\\text{, column }(m \\times 1)\\text{, square }(m = n)\\text{, zero/null,} \\\\" +
    "\\text{identity } I(a_{ij} = \\delta_{ij})\\text{, diagonal, scalar.}" +
    "\\end{array}"
  );
}

/**
 * Curriculum: "Matrix multiplication (AB): A is m x n and B is n x p -> AB is m x p; (AB)ij = Sigma_k aikbkj"
 * prettify may use × and may mangle "->" (e.g. " - >").
 */
function parseMatrixMultiplicationDefinitionTitle(raw: string): { line1: string; line2: string } | null {
  const n = raw.replace(/\s+/g, " ").trim().replace(/\.\s*$/, "");
  const parts = n.split(/\s*;\s*/).map((p) => p.trim());
  if (parts.length !== 2) return null;
  const [head, tail] = parts;
  if (!/^Matrix\s+multiplication\s*\(\s*AB\s*\)\s*:/i.test(head)) return null;
  if (!/\bA\s+is\s+m\s*[x×]\s*n\b/i.test(head)) return null;
  if (!/\bB\s+is\s+n\s*[x×]\s*p\b/i.test(head)) return null;
  if (!/\bAB\s+is\s+m\s*[x×]\s*p\b/i.test(head)) return null;
  // "p -> AB" or prettify-mangled "p - > AB"
  if (!/p\s*(?:->|→|⇒)\s*AB\b/i.test(head) && !/p\s+-\s*>\s*AB\b/i.test(head)) return null;
  if (!/\(\s*AB\s*\)\s*ij\s*=/i.test(tail)) return null;
  const tailCompact = tail.replace(/\s+/g, "");
  if (!/(?:Sigma|Σ)/i.test(tail) || !/aik.*bkj|aikbkj/i.test(tailCompact)) return null;

  const line1 =
    "\\text{Matrix multiplication }(AB)\\text{ : }A\\text{ is }m\\times n\\text{ and }B\\text{ is }n\\times p\\Rightarrow AB\\text{ is }m\\times p\\text{;}";
  const line2 = "(AB)_{ij} = \\sum_{k} a_{ik}b_{kj}";
  return { line1, line2 };
}

function binaryRelationPropertyHeading(raw: string): { label: string; definitionLatex: string } | null {
  const normalized = raw.replace(/\s+/g, " ").trim();
  const hm = normalized.match(
    /^((Reflexive|Symmetric|Transitive|Equivalence)\s+relation)\s*:\s*(.+)$/i,
  );
  if (!hm) return null;
  const kind = hm[2]!.toLowerCase();
  const label = `${hm[2]!.charAt(0).toUpperCase() + hm[2]!.slice(1).toLowerCase()} relation`;
  const body = hm[3]!.trim();

  if (kind === "reflexive") {
    const def = parseReflexiveDefinition(body);
    if (def) return { label, definitionLatex: def };
  }
  if (kind === "symmetric") {
    const def = parseSymmetricDefinition(body);
    if (def) return { label, definitionLatex: def };
  }
  if (kind === "transitive") {
    const def = parseTransitiveDefinition(body);
    if (def) return { label, definitionLatex: def };
  }
  if (kind === "equivalence") {
    const b = normalizeRelationTitleBody(body);
    if (/^reflexive\s*\+\s*symmetric\s*\+\s*transitive$/i.test(b)) {
      return {
        label,
        definitionLatex: "\\text{reflexive} + \\text{symmetric} + \\text{transitive}\\text{.}",
      };
    }
  }
  return null;
}

function relationEqPlainToLatex(formulaRaw: string): string {
  let s = formulaRaw.trim();
  const trailingDot = /\.\s*$/.test(s);
  if (trailingDot) s = s.replace(/\.\s*$/, "").trim();
  s = s.replace(/\u2205/g, "\\emptyset");
  s = s.replace(/\u2286/g, "\\subseteq");
  s = s.replace(/\u2282/g, "\\subset");
  s = s.replace(/\u00D7/g, "\\times");
  s = s.replace(/\u00B2/g, "^2");
  s = s.replace(/\bA\s+x\s+A\b/gi, "A \\times A");
  s = s.replace(/\b([A-Z])\s+x\s+([A-Z])\b/g, "$1 \\times $2");
  s = s.replace(/\bphi\b/gi, "\\emptyset");
  s = s.replace(/\bempty\s*set\b/gi, "\\emptyset");
  s = s.replace(/\bsubseteq\b/gi, "\\subseteq");
  s = s.replace(/\bsubset\s+of\b/gi, "\\subseteq");
  s = s.replace(/\bproper\s+subset\s+of\b/gi, "\\subset");
  s = toLatex(s);
  if (trailingDot) s += "\\text{.}";
  return s;
}

function isStandardAreasTitle(text: string): boolean {
  const t = text.trim();
  return /^standard\s+areas\s*:/i.test(t) || /^standard\s+areas\s*$/i.test(t);
}

/** Strip leading \\text{Circle:}\\; so segment matches "Circle: …" parser. */
function normalizeStandardAreasSegment(segment: string): string {
  let s = segment.trim();
  s = s.replace(/^\\text\s*\{\s*Circle\s*:\s*\}\s*\\?;*\s*/i, "Circle: ");
  s = s.replace(/^\\text\s*\{\s*Parabola\s*:\s*\}\s*\\?;*\s*/i, "Parabola: ");
  s = s.replace(/\\\{\s*\\pi\s*\}/g, "\\pi");
  s = s.replace(/\{\s*\\pi\s*\}/g, "\\pi");
  return s;
}

function applyStandardAreasRestTransforms(rest: string): string {
  let r = rest.trim();
  r = r.replace(/\u00B2/g, "^2");
  r = r.replace(/\u00B3/g, "^3");
  r = r.replace(/\u03C0/g, "\\pi");
  r = r.replace(/\u21D2/g, " \\Rightarrow ");
  r = r.replace(/\u2192/g, " \\rightarrow ");
  r = r.replace(/\s*-\s*>\s*/g, " \\Rightarrow ");
  r = r.replace(/\s*[–—]\s*>\s*/g, " \\Rightarrow ");
  r = r.replace(/\s*->\s*/g, " \\Rightarrow ");
  r = r.replace(/\s*=>/g, " \\Rightarrow ");
  r = r.replace(/\bfrom\s+0\s+to\s+h\b/gi, "\\text{ from } 0 \\text{ to } h");
  r = r.replace(/\(\s*4a\s*\/\s*3\s*\)\s*\(\s*h\s*\/\s*4a\s*\)\^\{\s*3\s*\/\s*2\s*\}/gi, "\\frac{4a}{3}\\left(\\frac{h}{4a}\\right)^{3/2}");
  r = r.replace(/\(\s*4a\s*\/\s*3\s*\)\s*\(\s*h\s*\/\s*4a\s*\)\^\(3\/2\)/gi, "\\frac{4a}{3}\\left(\\frac{h}{4a}\\right)^{3/2}");
  r = r.replace(/x\^2\+y\^2=r\^2/gi, "x^2 + y^2 = r^2");
  r = r.replace(/\bx\^2\s*\+\s*y\^2\s*=\s*r\^2/gi, "x^2 + y^2 = r^2");
  r = r.replace(/\by\^2\s*=\s*4ax\b/gi, "y^2 = 4ax");
  // π·r² on one readable line (thin space between π and r; "pir" = π times r, not the word "pir")
  r = r.replace(/\bA\s*=\s*pi\s+r\^2/gi, "A = \\pi\\, r^{2}");
  r = r.replace(/\bA\s*=\s*pir\^2\b/gi, "A = \\pi\\, r^{2}");
  r = r.replace(/\bA\s*=\s*pir\s*2\b/gi, "A = \\pi\\, r^{2}");
  r = r.replace(/\bpi\s+r\^2\b/gi, "\\pi\\, r^{2}");
  r = r.replace(/\bpir\^2\b/gi, "\\pi\\, r^{2}");
  r = r.replace(/\bpir\b/gi, "\\pi\\, r");
  r = r.replace(/(?<!\\)\bpi\b/gi, "\\pi");
  return r;
}

/** Circle row → equation line + compact single-line area A = π r². */
function parseCircleTwoLines(norm: string): { eq: string; area: string } | null {
  const m = norm.match(/^circle(?:\s*:\s*|\s+)(.+)$/i);
  if (!m) return null;
  const body = m[1]!.trim();
  const pieces = body.split(/\s*\\Rightarrow\s*|\s*=>\s*|⇒/);
  if (pieces.length < 2) return null;
  const eq = toLatex(applyStandardAreasRestTransforms(pieces[0]!.trim()));
  let areaRaw = applyStandardAreasRestTransforms(pieces.slice(1).join(" \\Rightarrow ").trim());
  // Keep area as one tight math atom: A = π\, r² (KaTeX inline, no display wrap)
  areaRaw = areaRaw.replace(/\bA\s*=\s*\\pi\s*r\s*\^\s*\{?\s*2\s*\}?/i, "A = \\pi\\, r^{2}");
  areaRaw = areaRaw.replace(/\bA\s*=\s*\\pi\\,\s*r\s*\^\s*\{?\s*2\s*\}?/i, "A = \\pi\\, r^{2}");
  const area = toLatex(areaRaw);
  return { eq, area };
}

/** Parabola y²=4ax → intro + standard ∫ form (canonical area in first quadrant). */
function parseParabolaIntegralTitle(norm: string): { intro: string; body: string } | null {
  const m = norm.match(/^parabola(?:\s*:\s*|\s+)(.+)$/i);
  if (!m) return null;
  if (!/y\^2\s*=\s*4ax/i.test(m[1]!)) return null;
  return {
    intro:
      "\\text{Parabola:}\\; y^2 = 4ax \\text{ — area in the first quadrant from } x=0 \\text{ to } x=h \\text{:}",
    body: "A = \\int_{0}^{h} \\sqrt{4ax}\\,dx = \\frac{4}{3}\\sqrt{a}\\,h^{3/2}",
  };
}

function standardAreasSegmentToLatex(segment: string): { label: string; latex: string } | null {
  const s = normalizeStandardAreasSegment(segment.trim());
  const m = s.match(/^(circle|parabola)(?:\s*:\s*|\s+)(.+)$/i);
  if (!m) return null;
  const label = m[1]!.charAt(0).toUpperCase() + m[1]!.slice(1).toLowerCase();
  const rest = toLatex(applyStandardAreasRestTransforms(m[2]!.trim()));
  return { label, latex: rest };
}

/** One KaTeX string per row so the label + math stay one unit (no break before πr²). */
function standardAreasRowFullLatex(segment: string): string | null {
  const parsed = standardAreasSegmentToLatex(normalizeStandardAreasSegment(segment));
  if (parsed) {
    return `\\text{${parsed.label}:}\\; ${parsed.latex}`;
  }
  const t = normalizeStandardAreasSegment(segment.trim());
  if (!t) return null;
  return toLatex(t);
}

/** Render LaTeX string to HTML, or null on failure. */
function renderLatex(latex: string, displayMode: boolean): string | null {
  try {
    return katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      output: "html",
      strict: false,
    });
  } catch {
    return null;
  }
}

/** Detect if string looks like it contains math notation (subscripts, superscripts, etc.). */
function hasMathNotation(text: string): boolean {
  return (
    /[_^\\]|\d+\s*x\s+\d|piepsilon|lambda|\$|\\\(|\\\[/.test(text) ||
    /[\u00B2\u00B3\u2070-\u209F\u03C0\u2205\u2286\u00D7]/.test(text) ||
    /\bpir\d|\bpir\^|\bstandard\s+areas\s*:/i.test(text) ||
    /;\s*R\s*=/i.test(text) ||
    /\bsubset\s+of\b/i.test(text) ||
    /^\s*(?:Reflexive|Symmetric|Transitive|Equivalence)\s+relation\s*:/i.test(text) ||
    /^\s*Equivalence\s+class\s+\[/i.test(text) ||
    /^\s*Injective\s+\(\s*(?:one\s*-\s*to\s*-\s*one|one-to-one)\s*\)\s*:/i.test(text) ||
    /^\s*Surjective\s+\(\s*onto\s*\)\s*:/i.test(text) ||
    /^\s*Bijective\s*:/i.test(text) ||
    /^\s*Adjoint\s*:\s*adj\s*\(/i.test(text) ||
    /^\s*Minor\s+Mij\s*:/i.test(text) ||
    /^\s*Cofactor\s+Cij\s*=/i.test(text) ||
    /^\s*Using elementary row operations to find/i.test(text) ||
    /^\s*Types:\s*row\s+matrix/i.test(text) ||
    /Matrix\s+multiplication\s*\(\s*AB\s*\)/i.test(text) ||
    /\([a-z]\s*,\s*[a-z]\)\s+in\s+[A-Za-z]/i.test(text)
  );
}

type MathChunk = { text: string; isMath: boolean; displayMode: boolean };

function splitIntoMathChunks(text: string): MathChunk[] {
  const pattern = /(\\\((?:[\s\S]+?)\\\)|\\\[(?:[\s\S]+?)\\\]|\$\$(?:[\s\S]+?)\$\$|\$(?:[^$\n]+?)\$)/g;
  const chunks: MathChunk[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) {
      chunks.push({ text: text.slice(last, m.index), isMath: false, displayMode: false });
    }
    const token = m[0];
    let inner = token;
    let displayMode = false;
    if (token.startsWith("\\(") && token.endsWith("\\)")) inner = token.slice(2, -2);
    else if (token.startsWith("\\[") && token.endsWith("\\]")) {
      inner = token.slice(2, -2);
      displayMode = true;
    } else if (token.startsWith("$$") && token.endsWith("$$")) {
      inner = token.slice(2, -2);
      displayMode = true;
    } else if (token.startsWith("$") && token.endsWith("$")) inner = token.slice(1, -1);
    chunks.push({ text: inner, isMath: true, displayMode });
    last = m.index + token.length;
  }
  if (last < text.length) {
    chunks.push({ text: text.slice(last), isMath: false, displayMode: false });
  }
  return chunks;
}

/**
 * Detects mixed heading style like:
 * "Force F = ..." or "Vector form : F_1_2 = ..."
 * and separates the plain-text label from the formula expression.
 */
function splitLabelAndFormula(text: string): { label: string; formula: string } | null {
  const trimmed = text.trim();
  const m = trimmed.match(/^([A-Za-z][A-Za-z\s-]{1,50}?)\s*[:]\s*(.+)$/);
  if (m) {
    return {
      label: m[1]!.trim(),
      formula: m[2]!.trim(),
    };
  }

  const eq = trimmed.match(/^([A-Za-z][A-Za-z\s-]{1,50}?)\s+([A-Za-z](?:_[0-9]+(?:_[0-9]+)?)?)\s*=\s*(.+)$/);
  if (!eq) return null;
  return {
    label: eq[1]!.trim(),
    formula: `${eq[2]!.trim()} = ${eq[3]!.trim()}`,
  };
}

interface MathTextProps {
  children: string;
  displayMode?: boolean;
  className?: string;
  title?: string;
  as?: "span" | "div";
  /** Heavier weight for headings (plain text + KaTeX formulas). */
  weight?: "normal" | "semibold" | "bold" | "extrabold";
}

/**
 * Renders text that may contain LaTeX-style math (e.g. q_1, r^2, piepsilon_0).
 * Falls back to plain text if rendering fails.
 */
const WEIGHT_CLASS: Record<NonNullable<MathTextProps["weight"]>, string> = {
  normal: "",
  semibold: "font-semibold",
  bold: "font-bold",
  extrabold: "font-extrabold",
};

function katexWeightClass(weight: NonNullable<MathTextProps["weight"]>): string {
  if (weight === "normal") return "";
  if (weight === "extrabold") return "math-text-katex-extra";
  return "math-text-katex-heavy";
}

export default function MathText({
  children,
  displayMode = false,
  className = "",
  title,
  as: Tag = "span",
  weight = "normal",
}: MathTextProps) {
  const w = WEIGHT_CLASS[weight];
  const rawBase = String(children).trim();
  if (!rawBase) return <Tag className={`${w} ${className}`.trim()} />;

  const equivParts = parseEquivalenceClassCurriculumParts(rawBase);
  if (equivParts) {
    const htmlHead = renderLatex(toLatex(equivParts.prefixLatex), displayMode);
    const htmlBody = renderLatex(toLatex(equivParts.suffixLatex), displayMode);
    const katexW = katexWeightClass(weight);
    if (htmlHead && htmlBody) {
      return (
        <Tag
          className={`subtopic-equivalence-class-title ${w} ${className} flex flex-col gap-1 max-w-full min-w-0 overflow-hidden leading-snug`.trim()}
          title={title}
        >
          <span
            className={`${katexW} subtopic-equivalence-class-line subtopic-equivalence-class-line--head block w-full min-w-0 overflow-hidden`}
            dangerouslySetInnerHTML={{ __html: htmlHead }}
          />
          <span
            className={`${katexW} subtopic-equivalence-class-line subtopic-equivalence-class-line--body block w-full min-w-0 overflow-hidden`}
            dangerouslySetInnerHTML={{ __html: htmlBody }}
          />
        </Tag>
      );
    }
    return (
      <Tag className={`${w} ${className} whitespace-normal`.trim()} title={title}>
        {rawBase}
      </Tag>
    );
  }

  const injFn = parseInjectiveFunctionTitleParts(rawBase);
  if (injFn) {
    const h1 = renderLatex(toLatex(injFn.line1), displayMode);
    const h2 = renderLatex(toLatex(injFn.line2), displayMode);
    const katexW = katexWeightClass(weight);
    if (h1 && h2) {
      return (
        <Tag
          className={`subtopic-function-def-title ${w} ${className} flex flex-col gap-1 max-w-full min-w-0 overflow-hidden leading-snug`.trim()}
          title={title}
        >
          <span
            className={`${katexW} subtopic-function-def-line subtopic-function-def-line--head block w-full min-w-0 overflow-hidden`}
            dangerouslySetInnerHTML={{ __html: h1 }}
          />
          <span
            className={`${katexW} subtopic-function-def-line subtopic-function-def-line--body block w-full min-w-0 overflow-hidden`}
            dangerouslySetInnerHTML={{ __html: h2 }}
          />
        </Tag>
      );
    }
  }

  const surFn = parseSurjectiveFunctionTitleParts(rawBase);
  if (surFn) {
    const h1 = renderLatex(toLatex(surFn.line1), displayMode);
    const h2 = renderLatex(toLatex(surFn.line2), displayMode);
    const katexW = katexWeightClass(weight);
    if (h1 && h2) {
      return (
        <Tag
          className={`subtopic-function-def-title ${w} ${className} flex flex-col gap-1 max-w-full min-w-0 overflow-hidden leading-snug`.trim()}
          title={title}
        >
          <span
            className={`${katexW} subtopic-function-def-line subtopic-function-def-line--head block w-full min-w-0 overflow-hidden`}
            dangerouslySetInnerHTML={{ __html: h1 }}
          />
          <span
            className={`${katexW} subtopic-function-def-line subtopic-function-def-line--body block w-full min-w-0 overflow-hidden`}
            dangerouslySetInnerHTML={{ __html: h2 }}
          />
        </Tag>
      );
    }
  }

  const bijLatex = parseBijectiveFunctionTitleLatex(rawBase);
  if (bijLatex) {
    const html = renderLatex(toLatex(bijLatex), displayMode);
    const katexW = katexWeightClass(weight);
    if (html) {
      return (
        <Tag
          className={`subtopic-function-def-title ${w} ${className} flex flex-col gap-0.5 max-w-full min-w-0 overflow-hidden leading-snug`.trim()}
          title={title}
        >
          <span
            className={`${katexW} subtopic-function-def-line block w-full min-w-0 overflow-hidden`}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </Tag>
      );
    }
  }

  const invTrigDomainRange = parseInverseTrigDomainRangeTitle(rawBase);
  if (invTrigDomainRange) {
    const html = renderLatex(toLatex(invTrigDomainRange), displayMode);
    const katexW = katexWeightClass(weight);
    if (html) {
      return (
        <Tag
          className={`subtopic-function-def-title ${w} ${className} block max-w-full min-w-0 overflow-hidden leading-snug`.trim()}
          title={title}
        >
          <span
            className={`${katexW} subtopic-function-def-line block w-full min-w-0 overflow-hidden`}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </Tag>
      );
    }
  }

  const adjointCofactorTranspose = parseAdjointCofactorTransposeTitle(rawBase);
  if (adjointCofactorTranspose) {
    const html = renderLatex(toLatex(adjointCofactorTranspose), displayMode);
    const katexW = katexWeightClass(weight);
    if (html) {
      return (
        <Tag
          className={`subtopic-function-def-title ${w} ${className} block max-w-full min-w-0 overflow-hidden leading-snug`.trim()}
          title={title}
        >
          <span
            className={`${katexW} subtopic-function-def-line block w-full min-w-0 overflow-hidden`}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </Tag>
      );
    }
  }

  const minorMijTitle = parseMinorMijDefinitionTitle(rawBase);
  if (minorMijTitle) {
    const html = renderLatex(toLatex(minorMijTitle), displayMode);
    const katexW = katexWeightClass(weight);
    if (html) {
      return (
        <Tag
          className={`subtopic-function-def-title ${w} ${className} block max-w-full min-w-0 overflow-hidden leading-snug`.trim()}
          title={title}
        >
          <span
            className={`${katexW} subtopic-function-def-line block w-full min-w-0 overflow-hidden`}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </Tag>
      );
    }
  }

  const cofactorCijTitle = parseCofactorCijTitle(rawBase);
  if (cofactorCijTitle) {
    const html = renderLatex(toLatex(cofactorCijTitle), displayMode);
    const katexW = katexWeightClass(weight);
    if (html) {
      return (
        <Tag
          className={`subtopic-function-def-title ${w} ${className} block max-w-full min-w-0 overflow-hidden leading-snug`.trim()}
          title={title}
        >
          <span
            className={`${katexW} subtopic-function-def-line block w-full min-w-0 overflow-hidden`}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </Tag>
      );
    }
  }

  const elementaryRowOpsInverse = parseElementaryRowOpsInverseTitle(rawBase);
  if (elementaryRowOpsInverse) {
    const html = renderLatex(toLatex(elementaryRowOpsInverse), true);
    const katexW = katexWeightClass(weight);
    if (html) {
      return (
        <Tag
          className={`subtopic-function-def-title ${w} ${className} block max-w-full min-w-0 overflow-hidden leading-snug text-left`.trim()}
          title={title}
        >
          <span
            className={`${katexW} subtopic-function-def-line block w-full min-w-0 overflow-hidden [&>.katex-display]:!text-left [&>.katex-display]:mx-0`}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </Tag>
      );
    }
  }

  const matrixTypesCatalog = parseMatrixTypesCatalogTitle(rawBase);
  if (matrixTypesCatalog) {
    const html = renderLatex(toLatex(matrixTypesCatalog), true);
    const katexW = katexWeightClass(weight);
    if (html) {
      return (
        <Tag
          className={`subtopic-function-def-title ${w} ${className} block max-w-full min-w-0 overflow-hidden leading-snug text-left`.trim()}
          title={title}
        >
          <span
            className={`${katexW} subtopic-function-def-line block w-full min-w-0 overflow-hidden [&>.katex-display]:!text-left [&>.katex-display]:mx-0`}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </Tag>
      );
    }
  }

  const matrixMultDef = parseMatrixMultiplicationDefinitionTitle(rawBase);
  if (matrixMultDef) {
    const h1 = renderLatex(toLatex(matrixMultDef.line1), true);
    const h2 = renderLatex(toLatex(matrixMultDef.line2), true);
    const katexW = katexWeightClass(weight);
    if (h1 && h2) {
      return (
        <Tag
          className={`subtopic-function-def-title ${w} ${className} flex flex-col gap-2 max-w-full min-w-0 overflow-hidden leading-snug`.trim()}
          title={title}
        >
          <span
            className={`${katexW} subtopic-function-def-line subtopic-function-def-line--head block w-full min-w-0 overflow-hidden text-left [&>.katex-display]:!text-left [&>.katex-display]:mx-0`}
            dangerouslySetInnerHTML={{ __html: h1 }}
          />
          <span
            className={`${katexW} subtopic-function-def-line subtopic-function-def-line--body subtopic-matmult-sum-line2 block w-full min-w-0 overflow-hidden text-center [&>.katex-display]:mx-auto`}
            dangerouslySetInnerHTML={{ __html: h2 }}
          />
        </Tag>
      );
    }
  }

  const adjointInverseLatex = parseAdjointInverseFormulaTitle(rawBase);
  if (adjointInverseLatex) {
    const html = renderLatex(toLatex(adjointInverseLatex), displayMode);
    const katexW = katexWeightClass(weight);
    if (html) {
      return (
        <Tag
          className={`subtopic-function-def-title ${w} ${className} block max-w-full min-w-0 overflow-hidden leading-snug`.trim()}
          title={title}
        >
          <span
            className={`${katexW} subtopic-function-def-line block w-full min-w-0 overflow-hidden`}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </Tag>
      );
    }
  }

  const proseRelation = splitProseSemicolonRelationEq(rawBase);
  if (proseRelation) {
    const latex = relationEqPlainToLatex(proseRelation.formulaRaw);
    const html = renderLatex(latex, displayMode);
    const katexW = katexWeightClass(weight);
    const proseLine = proseRelation.prose.endsWith(";") ? proseRelation.prose : `${proseRelation.prose};`;
    return (
      <Tag
        className={`subtopic-relation-title ${w} ${className} inline-flex flex-col items-stretch gap-1 !break-normal max-w-full`.trim()}
        title={title}
      >
        <span className="block leading-snug tracking-tight">{proseLine}</span>
        <span className="subtopic-relation-title-formula block w-full min-w-0 overflow-hidden leading-[1.45] mt-0.5">
          {html ? (
            <span
              className={`${katexW} subtopic-relation-title-katex [&>.katex]:text-[0.98em] inline-block align-middle`}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : (
            <span className="whitespace-normal">{proseRelation.formulaRaw}</span>
          )}
        </span>
      </Tag>
    );
  }

  const relationProperty = binaryRelationPropertyHeading(rawBase);
  if (relationProperty) {
    const latex = toLatex(relationProperty.definitionLatex);
    const html = renderLatex(latex, displayMode);
    const katexW = katexWeightClass(weight);
    return (
      <Tag
        className={`subtopic-relation-property-title ${w} ${className} inline-flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 !break-normal max-w-full`.trim()}
        title={title}
      >
        <span className="shrink-0 text-primary">{relationProperty.label}:</span>
        {html ? (
          <span
            className={`${katexW} subtopic-relation-property-katex min-w-0 overflow-hidden leading-[1.45] [&>.katex]:text-[0.92em] sm:[&>.katex]:text-[0.98em] inline-block align-middle`}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <span className="whitespace-normal">{relationProperty.definitionLatex}</span>
        )}
      </Tag>
    );
  }

  if (isStandardAreasTitle(rawBase)) {
    const body = rawBase.replace(/^standard\s+areas\s*:\s*/i, "").trim();
    const parts = body.split(/\s*;\s*/).map((p) => normalizeStandardAreasSegment(p.trim())).filter(Boolean);
    const katexW = katexWeightClass(weight);
    return (
      <Tag
        className={`subtopic-standard-areas ${w} ${className} inline-flex flex-col items-stretch gap-3 !break-normal max-w-full`.trim()}
        title={title}
      >
        <span className="block leading-tight tracking-tight font-semibold text-foreground">Standard areas:</span>
        {parts.map((part, i) => {
          const circle2 = parseCircleTwoLines(part);
          if (circle2) {
            const hEq = renderLatex(circle2.eq, true);
            // Inline KaTeX so A = π r² stays on one line (π symbol, not "pir")
            const hArea = renderLatex(circle2.area, false);
            return (
              <span
                key={`sa-${i}`}
                className="subtopic-standard-areas-row flex flex-col gap-2 w-full min-w-0 overflow-x-auto leading-[1.45]"
              >
                <span className="text-sm font-bold text-primary shrink-0">Circle</span>
                {hEq ? (
                  <span
                    className={`${katexW} block w-full min-w-0 [&>.katex-display]:!text-left [&>.katex-display]:mx-0 [&>.katex]:text-[0.98em]`}
                    dangerouslySetInnerHTML={{ __html: hEq }}
                  />
                ) : null}
                {hArea ? (
                  <span
                    className={`${katexW} inline-block w-full min-w-0 whitespace-nowrap [&_.katex]:text-[0.98em] align-middle`}
                    dangerouslySetInnerHTML={{ __html: hArea }}
                  />
                ) : null}
              </span>
            );
          }
          const parab = parseParabolaIntegralTitle(part);
          if (parab) {
            const hIntro = renderLatex(parab.intro, false);
            const hBody = renderLatex(parab.body, true);
            return (
              <span
                key={`sa-${i}`}
                className="subtopic-standard-areas-row flex flex-col gap-2 w-full min-w-0 overflow-x-auto leading-[1.45]"
              >
                {hIntro ? (
                  <span
                    className={`${katexW} block w-full min-w-0 [&>.katex]:text-[0.95em]`}
                    dangerouslySetInnerHTML={{ __html: hIntro }}
                  />
                ) : null}
                {hBody ? (
                  <span
                    className={`${katexW} block w-full min-w-0 [&>.katex-display]:mx-auto [&>.katex]:text-[0.98em]`}
                    dangerouslySetInnerHTML={{ __html: hBody }}
                  />
                ) : null}
              </span>
            );
          }
          const combined = standardAreasRowFullLatex(part);
          const html = combined ? renderLatex(combined, displayMode) : null;
          return (
            <span
              key={`sa-${i}`}
              className="subtopic-standard-areas-row block w-full min-w-0 overflow-x-auto overflow-y-hidden leading-[1.45]"
            >
              {html ? (
                <span
                  className={`${katexW} subtopic-standard-areas-katex [&>.katex]:text-[0.98em] inline-block align-middle`}
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              ) : (
                <span className="whitespace-normal">{part}</span>
              )}
            </span>
          );
        })}
      </Tag>
    );
  }

  const raw = preprocessNakedMath(rawBase);

  if (!hasMathNotation(raw)) {
    return (
      <Tag
        className={`${w} ${className} min-w-0 max-w-full [overflow-wrap:anywhere] break-words whitespace-normal`.trim()}
        title={title}
      >
        {raw}
      </Tag>
    );
  }

  const chunks = splitIntoMathChunks(raw);
  if (chunks.some((c) => c.isMath)) {
    const katexW = katexWeightClass(weight);
    return (
      <Tag
        className={`${w} ${className} min-w-0 max-w-full [overflow-wrap:anywhere] break-words`.trim()}
        title={title}
      >
        {chunks.map((chunk, i) => {
          if (!chunk.isMath) return <React.Fragment key={`t-${i}`}>{chunk.text}</React.Fragment>;
          const html = renderLatex(toLatex(chunk.text), chunk.displayMode || displayMode);
          if (!html) return <React.Fragment key={`m-${i}`}>{chunk.text}</React.Fragment>;
          return (
            <span
              key={`m-${i}`}
              className={`${katexW} [&>.katex]:text-[1em] ${chunk.displayMode ? "block my-1 overflow-x-auto" : "align-middle"}`.trim()}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        })}
      </Tag>
    );
  }

  const areaSplit = splitDescriptionAndAreaFormula(raw);
  if (areaSplit) {
    const { eq, prose } = splitFormulaAtWhere(areaSplit.formula);
    const formulaHtml = renderLatex(toLatex(eq), displayMode);
    const katexW = katexWeightClass(weight);
    if (formulaHtml) {
      return (
        <Tag className={`${w} ${className}`.trim()} title={title}>
          <span className="whitespace-normal">{areaSplit.head}</span>
          <span className="whitespace-normal">: </span>
          <span
            className={`${katexW} [&>.katex]:text-[1em] align-middle`}
            dangerouslySetInnerHTML={{ __html: formulaHtml }}
          />
          {prose ? <span className="whitespace-normal"> {prose}</span> : null}
        </Tag>
      );
    }
  }

  const mixed = splitLabelAndFormula(raw);
  if (mixed) {
    const formulaLooksLikeProse =
      wordTokenCount(mixed.formula) > 5 &&
      /\b(and|from|to|axis|curve|between)\b/i.test(mixed.formula);
    if (formulaLooksLikeProse) {
      return (
        <Tag className={`${w} ${className}`.trim()} title={title}>
          <span className="whitespace-normal">
            {mixed.label}: {mixed.formula}
          </span>
        </Tag>
      );
    }
    const formulaHtml = renderLatex(toLatex(mixed.formula), displayMode);
    if (formulaHtml) {
      const katexW = katexWeightClass(weight);
      return (
        <Tag className={`${w} ${className}`.trim()} title={title}>
          <span>{mixed.label}: </span>
          <span
            className={`${katexW} [&>.katex]:text-[1em] align-middle`}
            dangerouslySetInnerHTML={{ __html: formulaHtml }}
          />
        </Tag>
      );
    }
  }

  // Avoid whole-string KaTeX for long prose + math (spaces collapse in math mode).
  if (wordTokenCount(raw) > 8 && !looksLikeRawTexExpression(raw)) {
    return (
      <Tag className={`${w} ${className}`.trim()} title={title}>
        <span className="whitespace-normal">{raw}</span>
      </Tag>
    );
  }

  const latex = toLatex(raw);
  const html = renderLatex(latex, displayMode);

  if (html) {
    const katexW = katexWeightClass(weight);
    return (
      <Tag
        className={`${w} ${katexW} [&>.katex]:text-[1em] max-w-full min-w-0 overflow-x-auto ${className}`.trim()}
        title={title}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return (
    <Tag
      className={`${w} ${className} min-w-0 max-w-full [overflow-wrap:anywhere] break-words`.trim()}
      title={title}
    >
      {raw}
    </Tag>
  );
}
