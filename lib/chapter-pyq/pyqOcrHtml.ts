import katex from "katex";
import { escapeHtmlTextNode } from "@/lib/mock/mockRichTextKatex";
import { SOLUTION_FIGURE_ROLES, resolvePyqFigureHtml, type PyqFigureFolder } from "@/lib/chapter-pyq/pyqFigures";
import type { PyqFigureLinkRow } from "@/lib/chapter-pyq/pyqQuestionRow";
import { parsePyqWorkedSolution } from "@/lib/chapter-pyq/pyqWorkedSolution";

const FIG_TOKEN = /\[\[fig:[^\]]+\]\]/g;
/** OCR leftovers such as `![circuit](https://i.imgur.com/your_image_placeholder.png)`. The real drawing is `[[fig:]]`. */
const MD_IMAGE = /!\[[^\]]*\](?:\([^)]*\))?/g;

/** Parked `[[fig:]]` token. Caption stripping must stop before it. */
const FIG_MARK = "\uE001";
/** Parked match-list / data table. The whitespace pass must not flatten its cells. */
const TABLE_MARK = "\uE002";
const NTA_TABLE = /<table\b[^>]*\bnta-pyq-table\b[^>]*>[\s\S]*?<\/table>/gi;

/** Document-AI captions for the printed figure — never part of the question paper. */
const IMAGE_CAPTION =
  /(?:The image\s+(?:displays|shows|is)\b|Note:\s*The function is not explicitly|It does not contain any charts|The diagram (?:features|illustrates|visually)|This image is)\b(?:(?!\uE001)[\s\S])*/i;

const HTML_TABLE = /<table\b[\s\S]*?<\/table>/gi;
const MD_TABLE = /\|[^\n]*\|[\s\S]*/;
/** Real markdown charts (`| :--- |`). Modulus `|z|` is not a table. */
const MD_TABLE_SEP = /\|[ \t]*:?-{2,}/;
const MATHONGO = /#\s*PaperPhodnaHai|www\.mathongo\.com|\bmathongo\b/gi;
const HEADING_LEAK =
  /\b(?:MUST DO PROBLEMS|CONCEPT BUILDER|ADVANCED(?: STYLE PROBLEMS)?|Spring force|Frictional force|Non-uniform Circular Motion|Power of iota|Algebra of complex numbers|Geometry of Complex Number|Locus Based on Distance Formula|Euler Form and De Moivres Theorem|Cube Root of Unity|Conjugate, modulus and argument|Rotation Theorem|nth roots of unity)\s*$/i;
const FIG_LABELS = /\bball\s*\(\s*a\s*\)\s*ball\s*\(\s*b\s*\)/gi;
const PAGE_TAIL = /(?<=\S{3})\s+(?:4[6-9]|5[0-9]|60)\s*$/;
const HASH_MI = /\s*#\s*#\s*mi\s*$/i;
/** Page-footer digits plus a leftover `mi` scrap on option 4. */
const PAGE_FOOTER = /(?<=\S)\s+\d{1,3}(?:\s+\d{1,3}){1,4}\s*(?:mi)?\s*$/i;
/** Booklet session tag. The player already shows the date on the question badge. */
const EXAM_SESSION_TAG = /\[\s*20\d{2}\s*\(\s*\d{1,2}\s+[A-Za-z]+\s+Shift\s*[12]\s*\)\s*\]/gi;

/**
 * Paper-only OCR: stem/option text as printed. Drop figure captions, invented
 * chart tables, markdown `**`, and overlay scraps. Keep `[[fig:KEY]]`.
 */
const OPTION_GRAPH =
  /^<img\b[^>]*\bclass="nta-mock-img nta-option-graph"[^>]*>$/i;

/** Survives the whitespace collapse, then becomes a blank line between stem blocks. */
const STEM_PARA = "\uE000";
/** A stored two-char `\n` is a line break — unless it starts `\neq`, `\notin`, `\nu`, `\nabla`, … */
const LITERAL_NEWLINE =
  /(?<!\\)\\n(?!(?:e|eq|eg|earrow|u|abla|ot|otin|i|mid|leq|geq|less|gtr|exists|parallel|subseteq|supseteq|leftarrow|rightarrow|Leftarrow|Rightarrow|leftrightarrow|Leftrightarrow|cong|sim|prec|succ|vdash|vDash|searrow|nwarrow|warrow|atural|ewline)(?![A-Za-z]))/g;
const ASSERTION_LABEL =
  String.raw`Assertion\s*\(\s*A\s*\)\s*:|Reason\s*\(\s*R\s*\)\s*:|Statement\s*[-–]?\s*(?:I{1,3}|[12])\s*:|In the light of the above`;

/**
 * Assertion–Reason stems are printed as separate lines. The cleaner collapses
 * every newline, so mark those breaks before the collapse and put them back after.
 */
/**
 * "A. … B. … C. …" lists are printed as one OCR line, including lists
 * that never say "statements". A real item starts with a capital, a digit,
 * or math, and the letters run in order. A passing mention such as
 * "both (A) and (B)" does not.
 */
function markLetterStatements(chunk: string): string {
  const mathSpans: Array<[number, number]> = [];
  const mathRe = /\$[^$]*\$/g;
  let math: RegExpExecArray | null;
  while ((math = mathRe.exec(chunk)) !== null) {
    mathSpans.push([math.index, math.index + math[0].length]);
  }
  const insideMath = (index: number) => mathSpans.some(([start, end]) => index >= start && index < end);
  const re = /(?:^|(?<=[\s:.]))(?:\(([A-E])\)|([A-E])\.)(?=\s+(?:[A-Z0-9$\\]))/g;
  const hits: { index: number; letter: string }[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(chunk)) !== null) {
    if (insideMath(match.index)) continue;
    hits.push({ index: match.index, letter: (match[1] || match[2] || "").toUpperCase() });
  }
  const order = ["A", "B", "C", "D", "E"] as const;
  const run: { index: number; letter: string }[] = [];
  let after = -1;
  for (const want of order) {
    const hit = hits.find((item) => item.letter === want && item.index > after);
    if (!hit) break;
    run.push(hit);
    after = hit.index;
  }
  if (run.length < 3) return chunk;
  let out = chunk;
  for (const hit of [...run].reverse()) {
    if (hit.index <= 0) continue;
    out = `${out.slice(0, hit.index).trimEnd()}${STEM_PARA}${out.slice(hit.index)}`;
  }
  return out.replace(/\s+(?=Choose the correct answer\b)/gi, STEM_PARA);
}

function protectStemParagraphs(s: string): string {
  const label = ASSERTION_LABEL;
  let out = s.replace(/\r\n/g, "\n").replace(LITERAL_NEWLINE, "\n");
  // Blank lines are printed blocks (a reaction, a structure, a Given list).
  // Single wrapped lines still collapse below.
  out = out.replace(/\n{2,}/g, STEM_PARA);
  out = out.replace(
    new RegExp(String.raw`\n+([^\n]{0,140}:)\n+(?=(?:${label}))`, "gi"),
    (_m, line: string) => `${STEM_PARA}${line.trim()}${STEM_PARA}`
  );
  out = out.replace(new RegExp(String.raw`\n+\s*(?=(?:${label}))`, "gi"), STEM_PARA);
  out = out.replace(new RegExp(String.raw`([.:])\s+(?=(?:${label}))`, "gi"), `$1${STEM_PARA}`);
  out = out.replace(
    new RegExp(
      String.raw`\.\s+(?=Consider\b[^:]{0,100}:\s+Assertion\s*\(\s*A\s*\)\s*:)`,
      "gi"
    ),
    `.${STEM_PARA}`
  );
  out = markLetterStatements(out);
  return out;
}

function restoreStemParagraphs(s: string): string {
  return s.replace(new RegExp(` ?${STEM_PARA} ?`, "g"), "\n\n");
}

export function cleanPyqOcrText(raw: string): string {
  const source = String(raw ?? "");
  // Choice graphs are the option itself. Leave the tag alone so the button
  // can show the plot instead of an OCR caption.
  if (OPTION_GRAPH.test(source.trim())) return source.trim();
  // Pull tokens out before caption/whitespace passes, then put each one back
  // where the paper printed it. Appending them all at the end drops a structure
  // that sits in the middle of the stem.
  const figs: string[] = [];
  const tables: string[] = [];
  let s = source.replace(FIG_TOKEN, (token) => {
    const mark = `${FIG_MARK}${figs.length}${FIG_MARK}`;
    figs.push(token);
    return mark;
  });
  s = s.replace(NTA_TABLE, (token) => {
    const mark = `${TABLE_MARK}${tables.length}${TABLE_MARK}`;
    tables.push(token);
    return mark;
  });
  s = s.replace(MD_IMAGE, " ");
  s = s.replace(/\*\*/g, "");
  s = s.replace(HTML_TABLE, " ");
  s = s.replace(IMAGE_CAPTION, " ");
  s = mapOutsideMath(s, (chunk) =>
    chunk.includes("|") && MD_TABLE_SEP.test(chunk) ? chunk.replace(MD_TABLE, " ") : chunk
  );
  s = s.replace(MATHONGO, " ");
  s = s.replace(FIG_LABELS, " ");
  s = s.replace(HEADING_LEAK, " ");
  s = s.replace(HASH_MI, " ");
  s = s.replace(PAGE_FOOTER, " ");
  s = s.replace(PAGE_TAIL, " ");
  s = s.replace(EXAM_SESSION_TAG, " ");
  s = protectStemParagraphs(s);
  s = s.replace(/\s+/g, " ").trim();
  // A fill-in blank is written `\_\_\_` outside math. KaTeX never sees it,
  // so the backslash would show. The paper blank is a run of underscores.
  s = mapOutsideMath(s, (chunk) => chunk.replace(/\\_/g, "_"));
  s = repairPyqKatex(s);
  s = restoreStemParagraphs(s);
  s = s.replace(new RegExp(`${FIG_MARK}(\\d+)${FIG_MARK}`, "g"), (_m, n: string) => figs[Number(n)] ?? "");
  s = s.replace(new RegExp(`${TABLE_MARK}(\\d+)${TABLE_MARK}`, "g"), (_m, n: string) => tables[Number(n)] ?? "");
  return s.trim();
}

const SUB_NUM: Record<string, string> = {
  "₀": "0",
  "₁": "1",
  "₂": "2",
  "₃": "3",
  "₄": "4",
  "₅": "5",
  "₆": "6",
  "₇": "7",
  "₈": "8",
  "₉": "9",
  "ₙ": "n",
  "ₘ": "m",
  "ₖ": "k",
  "ᵢ": "i",
  "ⱼ": "j",
  "ₜ": "t",
  "ₓ": "x",
  "ₐ": "a",
  "ₒ": "o",
  "ₛ": "s",
};

const SUP_NUM: Record<string, string> = {
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
  "ⁿ": "n",
  "⁺": "+",
  "⁻": "-",
};

const LETTER_CLASS = "A-Za-z\\u0370-\\u03FF";

const SWALLOWED_ENGLISH =
  /\s+(has|is equal|which of|for which|then|and|due|while|acting)\b/i;

function mapScripts(chars: string, table: Record<string, string>): string {
  return [...chars].map((c) => table[c] ?? c).join("");
}

function unicodeScriptsToLatex(s: string): string {
  let out = s;
  out = out.replace(/([⁰¹²³⁴⁵⁶⁷⁸⁹ⁿ⁺⁻]+)\/(\d+)/g, (_m, scripts: string, den: string) => {
    return `^{${mapScripts(scripts, SUP_NUM)}/${den}}`;
  });
  out = out.replace(
    new RegExp(`([${LETTER_CLASS}])([₀-₉ₙₘₖᵢⱼₜₓₐₒₛ]+)`, "g"),
    (_m, base: string, scripts: string) => `${base}_{${mapScripts(scripts, SUB_NUM)}}`
  );
  out = out.replace(
    new RegExp(`([${LETTER_CLASS}\\d\\)])([⁰-⁹ⁿ⁺⁻]+)`, "g"),
    (_m, base: string, scripts: string) => `${base}^{${mapScripts(scripts, SUP_NUM)}}`
  );
  out = out.replace(/\^\{1\}\/(\d+)/g, "^{1/$1}");
  return out;
}

function mapOutsideMath(s: string, fn: (chunk: string) => string): string {
  return s.split(/(\$[^$]*\$)/).map((part) => (part.startsWith("$") ? part : fn(part))).join("");
}

function isRichMath(side: string): boolean {
  return side.length > 2 || /[_^\\{]/.test(side);
}

function hasEnglishGlue(s: string): boolean {
  return /\b(and|the|then|are|for|with|both|such|that|roots|equation|acceleration|gravity|due|while)\b/i.test(
    s
  );
}

function katexInnerOk(inner: string): boolean {
  try {
    katex.renderToString(inner, { throwOnError: true });
    return true;
  } catch {
    return false;
  }
}

function dollarCount(s: string): number {
  return (s.match(/\$/g) ?? []).length;
}

function mathInners(s: string): string[] {
  return [...s.matchAll(/\$([^$]*)\$/g)].map((m) => m[1] ?? "");
}

function hasRawLatexOutsideMath(s: string): boolean {
  return s.split(/(\$[^$]*\$)/).some((part) => !part.startsWith("$") && /\\[a-zA-Z]+/.test(part));
}

function bracesUnbalanced(s: string): boolean {
  let depth = 0;
  for (const ch of s) {
    if (ch === "{") depth += 1;
    else if (ch === "}") depth -= 1;
    if (depth < 0) return true;
  }
  return depth !== 0;
}

/** Solver writeups must never reach the student stem. */
export function isPyqSolverDumpBody(body: string): boolean {
  const s = String(body ?? "");
  if (/\\boxed\s*\{/.test(s)) return true;
  if (/\bthe answer is\b/i.test(s)) return true;
  if (/\bwait,\s*let me\b/i.test(s)) return true;
  if (/\btherefore the absolute value\b/i.test(s)) return true;
  if (/\bcase\s+1\s*:/i.test(s)) return true;
  if (/\bwe need\b/i.test(s) && (s.length > 280 || /\b(compute|evaluate|note that|thus|hence)\b/i.test(s))) {
    return true;
  }
  if (
    /\bwe are given\b/i.test(s) &&
    (s.length > 400 || /\b(vieta|computing|therefore|hence|thus)\b/i.test(s))
  ) {
    return true;
  }
  if (
    (s.match(/\n\n/g) ?? []).length >= 2 &&
    s.length > 500 &&
    /\b(therefore|hence|thus|substituting)\b/i.test(s)
  ) {
    return true;
  }
  return false;
}

/** Odd `$`, unclosed braces/`\frac`, leftover `\\frac` outside math, or KaTeX parse errors. */
export function pyqStudentTextIsSafe(text: string): boolean {
  const s = String(text ?? "");
  if (dollarCount(s) % 2 === 1) return false;
  if (bracesUnbalanced(s)) return false;
  if (hasRawLatexOutsideMath(s)) return false;
  return mathInners(s).every((inner) => katexInnerOk(inner));
}

function latexifyPhysicsSymbols(inner: string): string {
  let t = inner
    .replace(/π/g, "\\pi")
    .replace(/μ/g, "\\mu")
    .replace(/ω/g, "\\omega")
    .replace(/∈/g, "\\in ")
    .replace(/θ/g, "\\theta")
    .replace(/≤/g, "\\le ")
    .replace(/≥/g, "\\ge ")
    .replace(/×/g, "\\times ")
    .replace(/>>/g, "\\gg ")
    .replace(/²/g, "^{2}")
    .replace(/³/g, "^{3}")
    .replace(/\\mu(?=[A-Za-z])/g, "\\mu ")
    .replace(/\\omega(?=[A-Za-z])/g, "\\omega ")
    .replace(/\\theta(?=[A-Za-z])/g, "\\theta ")
    .replace(/\\pi(?=[A-Za-z])/g, "\\pi ");
  t = t.replace(/\\mu _/g, "\\mu_");
  t = t.replace(/\\mu_([A-Za-z0-9])/g, "\\mu_{$1}");
  t = t.replace(/\\theta_([0-9]+)/g, "\\theta_{$1}");
  t = t.replace(/\\omega_([0-9]+)/g, "\\omega_{$1}");
  return t;
}

function isPhysicsFormulaChip(t: string): boolean {
  if (!t || t.includes("$") || t.length > 80) return false;
  if (t.includes("√")) return false;
  if (/\b(the|and|with|from|then|block|force|mass|when|which|while|correct|statement)\b/i.test(t)) {
    return false;
  }
  if (/^\d+\/\d+\s*g$/.test(t)) return true;
  return /[ωμπθ≤≥²³]|\\hat|F\/m|bv³|g\/\d|\d+g\/|1\/n|m\(v|μg|mω|dM\(|\/\d+\s*g$/.test(t);
}

function wrapOutside(s: string, pattern: RegExp, wrap: (m: string) => string): string {
  return mapOutsideMath(s, (chunk) =>
    chunk.replace(pattern, (m) => (hasEnglishGlue(m) ? m : wrap(m)))
  );
}

const HAT_TERM =
  "(?:-?\\d+[A-Za-z]*\\^{[^}]+}\\\\hat\\{[ijk]\\}|-?\\d+[A-Za-z]*\\\\hat\\{[ijk]\\}|[A-Za-z]\\\\hat\\{[ijk]\\}|\\\\hat\\{[ijk]\\})";

function wrapPhysicsKatex(chunk: string): string {
  let c = chunk.replace(/~\s*/g, " ");
  c = c.replace(
    /\(\s*([^()]*(?:\\hat\{[ijk]\}[^()]*)+)\)\s*(m\b)?/g,
    (_m, inner: string, unit: string | undefined) =>
      `$(${inner.trim()})${unit ? "\\,\\mathrm{m}" : ""}$`
  );
  c = mapOutsideMath(c, (out) => {
    let o = out;
    o = o.replace(
      new RegExp(`((?:${HAT_TERM})(?:\\s*[+\\-]\\s*(?:${HAT_TERM}|-?\\d*[A-Za-z]))+)`, "g"),
      (run) => (run.includes("$") ? run : `$${run}$`)
    );
    o = o.replace(/\bπ\s*\/\s*(\d+)\b/g, `$\\pi/$1$`);
    o = o.replace(/\(3\/π\)/g, `$\\left(3/\\pi\\right)$`);
    o = o.replace(/π²\s*=\s*([\d.]+)/g, `$\\pi^{2} = $1$`);
    o = o.replace(/\bm\/s²/g, `$\\mathrm{m/s}^{2}$`);
    o = o.replace(/\bm\/s\^\{2\}/g, `$\\mathrm{m/s}^{2}$`);
    o = o.replace(/\bms¹\b/g, `$\\mathrm{m\\,s^{-1}}$`);
    o = o.replace(/\b([0-9.]+)\s*kg m s⁻¹/g, (_m, n: string) => `$${n}\\,\\mathrm{kg\\,m\\,s^{-1}}$`);
    o = o.replace(/\b([0-9.]+)\s*m s⁻¹/g, (_m, n: string) => `$${n}\\,\\mathrm{m\\,s^{-1}}$`);
    o = o.replace(/\b([0-9.]+)\s*m s⁻²/g, (_m, n: string) => `$${n}\\,\\mathrm{m\\,s^{-2}}$`);
    o = o.replace(/\b(\d+g\/\d+)\b/g, `$$$1$`);
    o = o.replace(/\bg\/(\d+)\b/g, `$g/$1$`);
    o = o.replace(/\b1\/n²\b/g, `$1/n^{2}$`);
    o = o.replace(/μₛ\s*=\s*([\d.]+)/g, `$\\mu_{s} = $1$`);
    o = o.replace(/(?<![$\w\\])μ\s*=\s*([\d.]+)/g, `$\\mu = $1$`);
    o = o.replace(/\b([mnF])_([A-Z])\s*=\s*([\d.]+)/g, `$$$1_{$2} = $3$`);
    o = o.replace(/dM\(t\)\/dt\s*=\s*bv²\(t\)/g, `$dM(t)/dt = bv^{2}(t)$`);
    o = o.replace(/\(k\s*>>\s*mω²\)/g, `($k \\gg m\\omega^{2}$)`);
    const t = o.trim();
    if (isPhysicsFormulaChip(t)) {
      o = `$${latexifyPhysicsSymbols(t)}$`;
    } else if (!t.includes("$") && /\\hat\{[ijk]\}/.test(t) && t.length <= 80) {
      o = `$${t}$`;
    }
    return o;
  });
  return c;
}

function wrapNakedAlgebra(chunk: string): string {
  let c = chunk;
  c = wrapOutside(
    c,
    /((?:[A-Za-z\u0370-\u03FF]\w*)+\^{[^}]+}(?:\s*[+\-]\s*(?:\d+[A-Za-z\u0370-\u03FF]*|[A-Za-z\u0370-\u03FF]\w*(?:\^{[^}]+})?|\|[^|]+\|))+\s*=\s*-?[A-Za-z\u0370-\u03FF0-9]+)/g,
    (m) => `$${m}$`
  );
  c = wrapOutside(
    c,
    /((?:\(\([^)]+\)\)|[A-Za-z\u0370-\u03FF0-9()]+)\^{[^}]+}(?:\s*[+\-/*]\s*(?:\([^)]+\)|[A-Za-z\u0370-\u03FF0-9|]+)+(?:\^{[^}]+})?)*\s*=\s*-?[A-Za-z\u0370-\u03FF0-9]+)/g,
    (m) => `$${m}$`
  );
  c = wrapOutside(
    c,
    /((?:[A-Za-z\u0370-\u03FF0-9()]+)\^{[^}]+}[A-Za-z\u0370-\u03FF0-9()+\-/*\s]{0,80}[<>]=?\s*-?\d+)/g,
    (m) => `$${m}$`
  );
  c = wrapOutside(
    c,
    new RegExp(
      `\\b([${LETTER_CLASS}](?:_\\{[^}]+\\})?\\s*=\\s*[${LETTER_CLASS}0-9]+(?:\\^\\{[^}]+\\})?(?:\\s*[+]\\s*[${LETTER_CLASS}0-9]+(?:\\^\\{[^}]+\\})?)+)`,
      "g"
    ),
    (m) => `$${m}$`
  );
  c = wrapOutside(c, new RegExp(`((?:\\d+)?[${LETTER_CLASS}]+\\^\\{[^}]+\\})`, "g"), (m) => `$${m}$`);
  c = wrapOutside(c, /(\([^)]+\)\^\{[^}]+\})/g, (m) => `$${m}$`);
  return c;
}

const LATEX_FN =
  /^(arg|sin|cos|tan|sec|csc|cot|log|ln|lim|min|max|inf|sup|det|gcd|exp|mod|Re|Im)$/;
const LATEX_STOP =
  /^(Let|let|where|then|and|the|with|for|such|that|which|find|if|of|is|are|a|an|Given|given|when|whose|equals|equal|than|this|from|into|onto|also|but)\b/;

function matchingBrace(s: string, openIdx: number): number {
  let depth = 0;
  for (let i = openIdx; i < s.length; i++) {
    if (s[i] === "{") depth += 1;
    else if (s[i] === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function isMathWord(word: string): boolean {
  if (word.length <= 2) return true;
  return LATEX_FN.test(word);
}

/** Wrap leftover `\\frac` / `\\in` / `\\mathbb` so `useKatexAutoRender` sees `$…$`. */
function wrapNakedLatexChunk(chunk: string): string {
  if (!/\\[a-zA-Z]/.test(chunk)) return chunk;
  let out = "";
  let i = 0;
  while (i < chunk.length) {
    const rel = chunk.slice(i).search(/\\[a-zA-Z]+/);
    if (rel < 0) {
      out += chunk.slice(i);
      break;
    }
    const cmdAt = i + rel;
    let start = cmdAt;
    let end = cmdAt + (chunk.slice(cmdAt).match(/^\\[a-zA-Z]+/)?.[0].length ?? 1);

    while (end < chunk.length) {
      const ch = chunk[end];
      if (ch === "{") {
        const close = matchingBrace(chunk, end);
        if (close < 0) {
          end = chunk.length;
          break;
        }
        end = close + 1;
        continue;
      }
      if (" \t_^=+-()|<>,.".includes(ch)) {
        end += 1;
        continue;
      }
      if (ch === "[" || ch === "]") {
        if (chunk.slice(end).startsWith("[[fig:")) break;
        end += 1;
        continue;
      }
      if (ch === "\\") {
        const m = chunk.slice(end).match(/^\\[a-zA-Z]+/);
        if (m) {
          end += m[0].length;
          continue;
        }
      }
      const word = chunk.slice(end).match(/^[A-Za-z][A-Za-z0-9]*/);
      if (word) {
        if (LATEX_STOP.test(word[0])) break;
        if (!isMathWord(word[0])) break;
        end += word[0].length;
        continue;
      }
      if (/[0-9]/.test(ch)) {
        end += 1;
        continue;
      }
      break;
    }

    while (start > i) {
      const ch = chunk[start - 1];
      if (" \t_^=+-()|<>,.".includes(ch)) {
        start -= 1;
        continue;
      }
      if (ch === "[" || ch === "]") {
        if (chunk.slice(start - 2, start + 4) === "[[fig:") break;
        start -= 1;
        continue;
      }
      if (/[A-Za-z0-9]/.test(ch)) {
        let j = start - 1;
        while (j >= i && /[A-Za-z0-9]/.test(chunk[j])) j -= 1;
        const word = chunk.slice(j + 1, start);
        if (LATEX_STOP.test(word)) break;
        if (/[A-Za-z]/.test(word) && !isMathWord(word) && !/^[0-9]+$/.test(word)) break;
        start = j + 1;
        continue;
      }
      break;
    }

    while (start < cmdAt && chunk[start] === " ") start += 1;
    while (end > cmdAt && chunk[end - 1] === " ") end -= 1;

    out += chunk.slice(i, start);
    const slice = chunk.slice(start, end);
    out += slice.startsWith("$") ? slice : `$${slice}$`;
    i = end;
  }
  return out;
}

function wrapNakedLatex(s: string): string {
  if (dollarCount(s) % 2 === 1) return s;
  return mapOutsideMath(s, wrapNakedLatexChunk);
}

const MATH_RUN_TAIL =
  /^(?:\s*[+\-]\s*(?:\d+[A-Za-z\u0370-\u03FF]*|[A-Za-z\u0370-\u03FF]\w*|\|[^|]+\|))+(?:\s*=\s*-?[A-Za-z\u0370-\u03FF0-9]+)?/;

/**
 * `$a$ - b` → `$a - b$`. Walks real `$…$` pairs: a bare regex would also treat the prose between
 * `$a$` and `$-2$` as a run and pull the `-2` out of its own math.
 */
function extendMathRuns(s: string): string {
  const parts = s.split(/(\$[^$]+\$)/);
  for (let i = 1; i < parts.length; i += 2) {
    const next = parts[i + 1] ?? "";
    const tail = next.match(MATH_RUN_TAIL)?.[0];
    if (!tail) continue;
    parts[i] = `${parts[i]!.slice(0, -1)}${tail}$`;
    parts[i + 1] = next.slice(tail.length);
  }
  return parts.join("");
}

function mergeAdjacentMath(s: string): string {
  let prev = "";
  let out = s;
  for (let i = 0; i < 14 && out !== prev; i++) {
    prev = out;
    out = out.replace(
      /\$([^$]+)\$\s*\+\s*\$([^$]+)\$\s*\/\s*(?:(\d+)\s*)?\$([^$]+)\$/g,
      (_m, a: string, b: string, coef: string | undefined, c: string) => {
        const token = (s: string) =>
          /^[A-Za-z]_\{[^}]+\}$/.test(s.trim()) || /^\\sqrt\{[^}]+\}[A-Za-z]_\{[^}]+\}$/.test(s.trim());
        if (!token(a) || !token(b) || !token(c)) return _m;
        return `$\\frac{${a.trim()}+${b.trim()}}{${coef ?? ""}${c.trim()}}$`;
      }
    );
    out = out.replace(
      /\$([^$]+)\$\s*\/\s*(?:(\d+)\s*)?\$([^$]+)\$/g,
      (_m, num: string, coef: string | undefined, den: string) => {
        if (!/_\{|\\sqrt/.test(`${num}${den}`)) return `$${num}$/${coef ?? ""}$${den}$`;
        return `$\\frac{${num.trim()}}{${coef ?? ""}${den.trim()}}$`;
      }
    );
    out = out.replace(/\$([^$]+)\/\$([^$]+)\$/g, (_m, num: string, den: string) => {
      if (!/_\{|\\sqrt/.test(`${num}${den}`)) return `$${num}$/$${den}$`;
      return `$\\frac{${num.trim()}}{${den.trim()}}$`;
    });
    out = out.replace(/\$([^$]+)\$(\s*[/+\-=]\s*)\$([^$]+)\$/g, (_m, a: string, op: string, b: string) => {
      if (!isRichMath(a) && !isRichMath(b) && op.trim() === "-") return `$${a}$${op}$${b}$`;
      if (a.includes("\\frac") || b.includes("\\frac")) return `$${a}$${op}$${b}$`;
      return `$${a}${op}${b}$`;
    });
    out = out.replace(/\$([^$]+)\$\$([^$]+)\$/g, (_m, a: string, b: string) => `$${a}${b}$`);
    out = extendMathRuns(out);
    out = out.replace(/\$([^$]+)=\s*\$(\s*-?[A-Za-z0-9]+)/g, (_m, lhs: string, rhs: string) => {
      return `$${lhs}= ${rhs.trim()}$`;
    });
    out = out.replace(/\$([^$]+)\$(\s*=\s*-?[A-Za-z\u0370-\u03FF0-9]+)/g, (_m, inner: string, eq: string) => {
      return `$${inner}${eq}$`;
    });
    out = out.replace(
      /([A-Za-z\u0370-\u03FF](?:_\{[^}]+\})?\s*=\s*)\$([^$]+)\$/g,
      (_m, lhs: string, rhs: string) => {
        if (/^\\(?:sqrt|frac)\{/.test(rhs.trim())) return _m;
        return `$${lhs}${rhs}$`;
      }
    );
    out = out.replace(
      /(^|[^$A-Za-z])([A-Za-z\u0370-\u03FF])\s*\+\s*\$([^$]+)\$/g,
      (_m, pre: string, letter: string, rest: string) => `${pre}$${letter} + ${rest}$`
    );
    out = out.replace(/(?<![$\w])(\d+)\$([A-Za-z\\(][^$]*)\$/g, (_m, n: string, inner: string) => {
      return `$${n}${inner}$`;
    });
    out = out.replace(/(\d+)\s*\$(\([^$]+)\$/g, (_m, n: string, inner: string) => `$${n}${inner}$`);
    out = out.replace(
      /(?<![$\w])([A-Za-z])\$(\\sqrt\{[^}]+\}[^$]*)\$/g,
      (_m, letter: string, inner: string) => `$${letter}${inner}$`
    );
    out = out.replace(
      /(?<![$\w])([A-Za-z])\$([A-Za-z]_\{[^}]+\}[^$]*)\$/g,
      (_m, letter: string, inner: string) => `$${letter}${inner}$`
    );
    out = out.replace(/\$([^$]+)\$\s+\$(\\mathrm\{[^$]+)\$/g, (_m, a: string, b: string) => {
      return `$${a}\\,${b}$`;
    });
    out = out.replace(/\$([^$]+)\$(\s*=\s*-?[A-Za-z0-9]+(?:\s*[/*]\s*[A-Za-z0-9]+)*)/g, (_m, inner: string, eq: string) => {
      if (hasEnglishGlue(eq)) return _m;
      return `$${inner}${eq}$`;
    });
  }
  out = out.replace(/\$([^$]+)\$/g, (_m, inner: string) => {
    const next = inner.replace(
      /([A-Za-z]_\{[^}]+\})\s*\+\s*\\sqrt\{([^}]+)\}([A-Za-z]_\{[^}]+\})\/(\d+)([A-Za-z]_\{[^}]+\})/g,
      (_mm, p25: string, rad: string, p24: string, coef: string, p23: string) =>
        `\\frac{${p25}+\\sqrt{${rad}}${p24}}{${coef}${p23}}`
    );
    return `$${next}$`;
  });
  return out;
}

function closeSwallowedEnglish(s: string): string {
  return s.replace(/\$([^$]+)\$/g, (run, inner: string) => {
    const cut = inner.search(SWALLOWED_ENGLISH);
    if (cut < 0) return run;
    const before = inner.slice(0, cut);
    if (/\\(?:text|mathrm|textbf|textit|mbox)\{[^}]*$/.test(before)) return run;
    return `$${inner.slice(0, cut).trim()}$ ${inner.slice(cut).trim()}`;
  });
}

/**
 * OCR/JSON sometimes stores JS `\u03c0` instead of π. KaTeX treats `\u` as a
 * breve, which paints `ŏ3c0` in the solution popup.
 */
export function decodePyqUnicodeEscapes(raw: string): string {
  return String(raw ?? "").replace(/\\u([0-9a-fA-F]{4})/g, (_m, hex: string) =>
    String.fromCharCode(Number.parseInt(hex, 16))
  );
}

function unescapedBraceDepth(tex: string): number {
  let depth = 0;
  for (let i = 0; i < tex.length; i += 1) {
    if (tex[i] === "\\") {
      i += 1;
      continue;
    }
    if (tex[i] === "{") depth += 1;
    else if (tex[i] === "}") depth -= 1;
  }
  return depth;
}

/** OCR used `(` … `}_{a}^{b}` for evaluation bars and left groups unclosed. */
function repairOcrEvalBraces(inner: string): string {
  let t = inner.replace(
    /\(\s*([^()]*?)\}\s*_(\{[^}]*\})\^(\{[^}]*\}|\d+(?:\/\d+)?)/g,
    (_m, body: string, lo: string, hi: string) => {
      const hiWrap = hi.startsWith("{") ? hi : `{${hi}}`;
      return `\\left[${body.trim()}\\right]_${lo}^{${hiWrap}}`;
    }
  );
  t = t.replace(/\(\s*([^()]+)\}\s*$/g, (_m, body: string) => `\\left(${body.trim()}\\right)`);
  const depth = unescapedBraceDepth(t);
  if (depth > 0) t += "}".repeat(depth);
  return t;
}

/** OCR wraps `sin`/`cos`/`sec` in `\\text{…}`; injecting `\\cos` inside `\\text` makes KaTeX paint the source. */
function unwrapOcrTrigText(s: string): string {
  return s
    .replace(/\\text\{\s*cosec\s*\}/gi, "\\csc")
    .replace(/\\text\{\s*\\?(sin|cos|tan|sec|csc|cot)\s*\}/gi, (_m, name: string) => `\\${name.toLowerCase()}`)
    .replace(/\\text\{\s*\\sqrt\s*\}(\d+)/g, "\\sqrt{$1}")
    .replace(/\\text\{\s*\\sqrt\s*\}/g, "\\sqrt");
}

function unicodeMathToLatex(raw: string): string {
  let s = unwrapOcrTrigText(
    decodePyqUnicodeEscapes(raw)
      .replace(/σοσ/g, "\\cos")
      .replace(/σιν/g, "\\sin")
      .replace(/θ/g, "\\theta")
      .replace(/π/g, "\\pi")
      .replace(/λ/g, "\\lambda ")
      .replace(/i\u0302|î/g, "\\hat{i}")
      .replace(/j\u0302|ĵ/g, "\\hat{j}")
      .replace(/k\u0302|k̂/g, "\\hat{k}")
      .replace(/n\u0302|n̂/g, "\\hat{n}")
      .replace(/a\u0302|â/g, "\\hat{a}")
      .replace(/b\u0302|b̂/g, "\\hat{b}")
      .replace(/c\u0302|ĉ/g, "\\hat{c}")
      .replace(/d\u0302|d̂/g, "\\hat{d}")
      .replace(/∫/g, "\\int")
      .replace(/∪(?=_)/g, "\\int")
      .replace(/√/g, "\\sqrt")
      .replace(/≤/g, "\\le ")
      .replace(/≥/g, "\\ge ")
      .replace(/∈/g, "\\in ")
      .replace(/→/g, "\\to ")
      .replace(/⇒/g, "\\Rightarrow ")
      .replace(/·/g, "\\cdot ")
      .replace(/⋅/g, "\\cdot ")
  );
  return s.replace(/\$([^$]*)\$/g, (_m, inner: string) => {
    const tex = repairOcrEvalBraces(
      inner
        .replace(/(?<!\\)\bsin\b/g, "\\sin")
        .replace(/(?<!\\)\bcos\b/g, "\\cos")
        .replace(/√\s*\(?([0-9A-Za-z\u0370-\u03FF]+)\)?/g, "\\sqrt{$1}")
        .replace(/√/g, "\\sqrt ")
    );
    return `$${tex}$`;
  });
}

/**
 * OCR math heuristics sometimes close `$v = 10$` before `\sqrt{x}`, leave a
 * trailing `*`, smash `$\sqrt{3}$` into the next `$P_{24}$`, and leave `x^{2}`
 * outside math. Fold those back into `$…$` so KaTeX can render.
 */
export function repairPyqKatex(raw: string): string {
  let s = decodePyqUnicodeEscapes(raw);
  s = s.replace(/\s+\*\s*$/g, "");
  s = s.replace(/√\s*\(?([0-9A-Za-z\u0370-\u03FF]+)\)?/g, "\\sqrt{$1}");
  s = s.replace(/√/g, "\\sqrt ");
  // Vision wraps `$` after `{` (`= {$ θ∈… }. $`) so KaTeX sees a stray `}` and
  // paints the backslash codes. Pull the brace into the math run.
  s = s.replace(/(?<!\\)\{\s*\$/g, "$\\{");
  s = s.replace(/\}\s*\.\s*\$/g, "\\}$");
  // Ingest used to collapse `$\sqrt{3}$$P_{24}$` → `$\sqrt{3$P_{24}$}`.
  s = s.replace(/\$\\sqrt\{([^$}]+)\$([^$]+)\$\}/g, (_m, rad: string, rest: string) => {
    return `$\\sqrt{${rad}}${rest}$`;
  });
  s = s.replace(/\\sqrt\{([^$}]+)\$([^$]+)\$\}/g, (_m, rad: string, rest: string) => {
    return `$\\sqrt{${rad}}${rest}$`;
  });
  s = s.replace(/\$([^$,\s][^$]*)\$\\sqrt\{([^}]+)\}\$/g, (_m, lhs: string, inner: string) => {
    // `$v = 10$\sqrt{x}$` is adjacent. `$ (i = $\sqrt{-1}$` is a different span.
    if (/=\s*$/.test(lhs) || /^\s/.test(lhs) || /^,/.test(lhs)) return _m;
    return `$${lhs}\\sqrt{${inner}}$`;
  });
  s = s.replace(/(\d+\/\d+)\s*\$\\sqrt\{([^}]+)\}\$?/g, (_m, frac: string, inner: string) => {
    return `$${frac}\\sqrt{${inner}}$`;
  });
  s = s.replace(/\$\\sqrt\{([^}]+)\}\s*\/\s*(\d+)/g, (_m, inner: string, den: string) => {
    return `$\\sqrt{${inner}}/${den}$`;
  });
  s = s.replace(/\$\\sqrt\{(\d+)([A-Za-z])\}\$/g, (_m, d: string, letter: string) => {
    return `$\\sqrt{${d}}${letter}$`;
  });
  s = s.replace(/(\d+)\s*\^\s*○/g, (_m, n: string) => `$${n}^{\\circ}$`);
  s = s.replace(/i\u0302|î/g, "\\hat{i}");
  s = s.replace(/j\u0302|ĵ/g, "\\hat{j}");
  s = s.replace(/k\u0302|k̂/g, "\\hat{k}");
  s = s.replace(/n\u0302|n̂/g, "\\hat{n}");
  s = s.replace(/a\u0302|â/g, "\\hat{a}");
  s = s.replace(/b\u0302|b̂/g, "\\hat{b}");
  s = s.replace(/c\u0302|ĉ/g, "\\hat{c}");
  s = s.replace(/d\u0302|d̂/g, "\\hat{d}");
  s = s.replace(/λ\s*\\hat\{/g, "\\lambda \\hat{");
  s = s.replace(/λ/g, "\\lambda ");
  s = s.replace(/\$\\lambda\$\s*\$\\hat\{/g, "$\\lambda \\hat{");
  s = s.replace(LITERAL_NEWLINE, "\n");
  s = s.replace(/\$([^$]+)\$([²³])(?:\/(\d+))?/g, (_m, inner: string, sup: string, den: string | undefined) => {
    const n = sup === "²" ? "2" : "3";
    return den ? `$${inner}^{${n}}/${den}$` : `$${inner}^{${n}}$`;
  });
  s = s.replace(/([A-Za-z\u0370-\u03FF)])²/g, "$1^{2}");
  s = s.replace(/([A-Za-z\u0370-\u03FF)])³/g, "$1^{3}");
  s = s.replace(
    /(^|[^$])(\b[A-Za-z]\s*=\s*)(\([^()]*(?:\\hat\{[ijk]\}[^()]*)+\))/g,
    (_m, prefix: string, lhs: string, paren: string) => `${prefix}$${lhs}${paren}$`
  );
  s = s.replace(
    /\$([^$]+)\$(\s*=\s*[^$]*\\hat\{[ijk]\}[^.$!]*)/g,
    (_m, name: string, rhs: string) => `$${name}${rhs}$`
  );
  s = mapOutsideMath(s, wrapPhysicsKatex);
  s = unicodeScriptsToLatex(s);
  s = s.replace(
    /([^$\s,()]{1,24})\$([A-Za-z]_\{[^}]+\})\$\/([^$\s,()]{1,24})/g,
    (_m, pre: string, v: string, post: string) => `$${pre}${v}/${post}$`
  );
  s = s.replace(/\$([^$]+)\$π/g, (_m, inner: string) => `$${inner}\\pi$`);
  s = wrapOutside(s, new RegExp(`(?<!\\$)([${LETTER_CLASS}]_\\{[0-9n]+\\})(?!\\$)`, "g"), (m) => `$${m}$`);
  s = s.replace(/∈\s*([RZNCQ])\b/g, (_m, letter: string) => `\\in \\mathbb{${letter}}`);
  s = s.replace(/(?<![\\$])∈(?!\s*\\mathbb)/g, "\\in ");
  s = s.replace(
    /\$([A-Za-z]\s*=\s*)\{([A-Za-z])\$/g,
    (_m, lhs: string, el: string) => `$${lhs}\\{${el}`
  );
  s = s.replace(
    /\$\\sqrt\{([^}]+)\}\$\s*\+\\sqrt\{([^}]+)\}\$/g,
    (_m, a: string, b: string) => `$\\sqrt{${a}}+\\sqrt{${b}}$`
  );
  s = s.replace(
    /(?:^|[\s,])[tₜ]\s*→\s*(-?[\d.]+)\s*\^\s*\+\s*([A-Za-z\u0370-\u03FF](?:_\{[^}]+\})?)\s*=\s*([A-Za-z])/g,
    (_m, n: string, fn: string, val: string) => ` $\\lim_{t \\to ${n}^{+}} ${fn} = ${val}$ `
  );
  s = closeSwallowedEnglish(s);
  s = mapOutsideMath(s, wrapNakedAlgebra);
  s = wrapNakedLatex(s);
  s = s.replace(/\b1\/(\d+[a-z](?:\+[a-z])?)\b/g, (_m, den: string) => `$\\frac{1}{${den}}$`);
  s = mergeAdjacentMath(s);
  s = s.replace(/(\b(?:m|kg|N|cm))\s*\$([A-Za-z]\^\{-?\d+\})\$/g, (_m, unit: string, rest: string) => {
    return `$${unit}\\,${rest}$`;
  });
  s = s.replace(/\$([^$]+)\$\.\s*(\d+)\s+m\s*\$([^$]+)\$/g, (_m, a: string, dec: string, b: string) => {
    return `$${a}.${dec}\\,m\\,${b}$`;
  });
  s = s.replace(/\$([^$]+)\$\.\s*(\d+)\s*\$([^$]+)\$/g, (_m, a: string, dec: string, b: string) => {
    return `$${a}.${dec}\\,${b}$`;
  });
  s = s.replace(/\$([^$]+)\$\.\s*(\d+)(?=\s|$|[A-Za-z])/g, (_m, a: string, dec: string) => `$${a}.${dec}$`);
  s = s.replace(/(\d+(?:\.\d+)?)\s*\$([^$]*(?:s\^\{-?\d+\}|\\mathrm\{)[^$]*)\$/g, (_m, n: string, rest: string) => {
    return `$${n}\\,${rest}$`;
  });
  s = s.replace(/\$([^$]+)\$\s*m\/s²/g, (_m, inner: string) => `$${inner}\\,\\mathrm{m/s}^{2}$`);
  s = s.replace(/\$([^$]+)\$\s*m\/s\^\{2\}/g, (_m, inner: string) => `$${inner}\\,\\mathrm{m/s}^{2}$`);
  s = s.replace(/\$([^$]+)\$\s*m\/s\b/g, (_m, inner: string) => `$${inner}\\,\\mathrm{m/s}$`);
  s = s.replace(
    /\bg\s*=\s*(\d+)\$\s*\\text\{\s*m\s*s\}\^\{-2\}\s*\)\s*\$/g,
    (_m, n: string) => `$g = ${n}\\,\\mathrm{m\\,s^{-2}}$`
  );
  s = s.replace(/\$([A-Za-z]\s*=\s*[A-Za-z]{6,})\$/g, (_m, inner: string) =>
    /[_^\\{]/.test(inner) ? `$${inner}$` : inner
  );
  s = wrapNakedLatex(s);
  s = s.replace(/\$([^$]+)\$/g, (_run, inner: string) => `$${latexifyPhysicsSymbols(inner)}$`);
  s = closeSwallowedEnglish(s);
  return s.replace(/\s{2,}/g, " ").trim();
}

/**
 * OCR bodies are Markdown-ish prose plus `[[fig:KEY]]` and `$…$` KaTeX.
 * The NTA stem renderer collapses raw newlines unless they live in HTML, so
 * wrap text runs in `<p>` and leave `$…$` for `useKatexAutoRender`.
 */
const COLUMN_DASH = "[\\u2014\\u2013]";
const ROMAN = "VIII|VII|VI|IV|IX|III|II|V|I";
/** `A.` / `A —` / `$A$`. A bare "a" or "A" is the article, not list item A. */
const LIST_MARK = String.raw`(?:\.\s*|\s*${COLUMN_DASH}\s*|(?<=\$)\s+)`;

function tableCell(text: string): string {
  return escapeHtmlTextNode(text.replace(/\s+/g, " ").trim());
}

function pyqTable(headers: string[], rows: string[][]): string {
  const head = headers.some((cell) => cell.trim())
    ? `<thead><tr>${headers.map((cell) => `<th>${tableCell(cell)}</th>`).join("")}</tr></thead>`
    : "";
  const body = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${tableCell(cell)}</td>`).join("")}</tr>`)
    .join("");
  return `<table class="nta-pyq-table">${head}<tbody>${body}</tbody></table>`;
}

/**
 * Match-lists and data charts are stored as one run of em dashes. The player
 * collapses that into a paragraph, so lift the printed columns into a table
 * before the cleaner runs.
 */
export function liftPyqTables(raw: string): string {
  const text = String(raw ?? "").replace(LITERAL_NEWLINE, "\n");
  return liftMatchList(text) ?? liftDataTable(text) ?? text;
}

function liftMatchList(text: string): string | null {
  const flat = text.replace(/\s+/g, " ").trim();
  const rowRe = new RegExp(
    String.raw`(?:^|\s)(?:\$)?([A-D])(?:\$)?${LIST_MARK}([\s\S]+?)\s*${COLUMN_DASH}\s*(?:\$)?(${ROMAN})(?:\$)?\.?\s*(?:${COLUMN_DASH}\s*)?([\s\S]+?)(?=\s+(?:\$)?[A-D](?:\$)?${LIST_MARK}|Choose the correct answer\b|$)`,
    "gi"
  );
  const rows: string[][] = [];
  for (const match of flat.matchAll(rowRe)) {
    const left = match[2]?.trim() ?? "";
    const right = match[4]?.trim() ?? "";
    if (!left || !right) continue;
    const tidy = (value: string) => value.replace(/^(?:[—–]|-)\s*/, "").trim();
    rows.push([`${match[1].toUpperCase()}.`, tidy(left), `${match[3].toUpperCase()}.`, tidy(right)]);
  }
  if (rows.length < 3) return null;
  const letters = rows.map((row) => row[0][0]).join("");
  if (letters !== "ABCD".slice(0, rows.length)) return null;
  const firstAt = flat.search(new RegExp(String.raw`(?:^|\s)(?:\$)?A(?:\$)?${LIST_MARK}`, "i"));
  if (firstAt < 0) return null;
  const chooseAt = flat.search(/Choose the correct answer\b/i);
  const intro = flat.slice(0, firstAt).trim();
  const outro = chooseAt >= 0 ? flat.slice(chooseAt).trim() : "";
  const titled = intro.match(
    new RegExp(String.raw`List-?\s*I\b\s*${COLUMN_DASH}\s*(.+?)\s*${COLUMN_DASH}\s*List-?\s*II\b\s*${COLUMN_DASH}\s*(.+)$`, "i")
  );
  const headers = titled
    ? ["", titled[1].trim(), "", titled[2].trim()]
    : ["", "List I", "", "List II"];
  const lead = intro
    .replace(new RegExp(String.raw`\s*List-?\s*I\b\s*${COLUMN_DASH}[\s\S]*$`, "i"), "")
    .trim();
  return [lead, pyqTable(headers, rows), outro].filter(Boolean).join("\n\n");
}

function liftDataTable(text: string): string | null {
  if (/match\s+list/i.test(text)) return null;
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const dashed = lines.filter((line) => (line.match(new RegExp(COLUMN_DASH, "g")) || []).length >= 2);
  if (dashed.length < 3) return null;
  const cells = dashed.map((line) => line.split(new RegExp(`\\s*${COLUMN_DASH}\\s*`)).map((cell) => cell.trim()).filter(Boolean));
  const width = cells[0]?.length ?? 0;
  if (width < 3 || width > 4 || cells.some((row) => row.length !== width)) return null;
  const first = lines.findIndex((line) => line === dashed[0]);
  const last = lines.findIndex((line) => line === dashed[dashed.length - 1]);
  if (first < 0 || last < first) return null;
  const lead = lines.slice(0, first).join(" ").trim();
  const outro = lines.slice(last + 1).join(" ").trim();
  return [lead, pyqTable(cells[0], cells.slice(1)), outro].filter(Boolean).join("\n\n");
}

export function pyqStemToHtml(
  body: string,
  links: PyqFigureLinkRow[] | null | undefined,
  folder: PyqFigureFolder = "physics/figures"
): string {
  const resolved = resolvePyqFigureHtml(cleanPyqOcrText(liftPyqTables(body)), links, folder);
  // `resolvePyqFigureHtml` wraps appended figures in a `<p>`. Splitting only on
  // `<img>` left those wrapper tags to be escaped, so students saw a literal
  // `<p>` / `</p>` around the diagram. Pass block tags through untouched.
  const parts = resolved.split(/(<img\b[^>]*>|<\/?p\b[^>]*>|<table\b[^>]*>[\s\S]*?<\/table>)/i);
  return parts
    .map((part) => {
      if (/^<img\b/i.test(part)) return part;
      if (/^<\/?p\b/i.test(part)) return part;
      if (/^<table\b/i.test(part)) return part;
      const text = part.replace(/\r\n/g, "\n").trim();
      if (!text) return "";
      return text
        .split(/\n{2,}|\n(?=(?:\([A-E]\)|[A-E]\.)\s)|\n(?=Choose the correct answer\b)/i)
        .map((para) => para.replace(/\n/g, " ").trim())
        .filter(Boolean)
        .map((para) => {
          const point = /^(?:\([A-E]\)|[A-E]\.)\s/.test(para);
          const cls = point ? "nta-math-plain nta-stem-point" : "nta-math-plain";
          return `<p class="${cls}">${escapeHtmlTextNode(para)}</p>`;
        })
        .join("");
    })
    .join("");
}

/** Worked solution markdown → NTA popup HTML. Do not run OCR caption stripping. */
const SOLUTION_STEP = /^(\d+)\.\s+/;
const PAPER_OCR_MARK = /<!--\s*paper-ocr\s*-->/g;
const SOLUTION_FIG_TOKEN = /(\[\[fig:[a-zA-Z0-9_]+\]\])/;
const CROP_FIG_TOKEN = /\[\[fig:[a-zA-Z0-9_]*_crop\]\]/gi;
const WATERMARK_LINE =
  /^(?:#\s*)?PaperPhodnaHai$|^www\.mathongo\.com$|^mathongo$|^Questions with Answer Keys$|^Definite Integration$|^Area Under Curves$|^Differential Equations$|^Chapter-wise Question Bank$|^JEE Main 20\d{2}(?:\s+\(January\)|\s+January|\s+April)?(?:\s+Chapter-wise Question Bank)?(?:\s+Question Bank)?$/i;
/** Printed "12. (3)" / "Q1. (2)" listing — already on the exam chrome. */
const PAPER_LISTING_PREFIX =
  /^(?:Q\s*\d{1,2}\.\s*(?:\([^)]+\)\s*)?|\d{1,2}\.\s*\([^)]+\)\s*)/;

function solutionInlineHtml(text: string): string {
  return text
    .split(/(<img\b[^>]*>)/i)
    .map((part) => (/^<img\b/i.test(part) ? part : escapeHtmlTextNode(part)))
    .join("");
}

function splitSolutionChunks(raw: string): string[] {
  const parts = raw.split(SOLUTION_FIG_TOKEN);
  const chunks: string[] = [];
  for (const part of parts) {
    if (!part) continue;
    if (/^\[\[fig:/.test(part)) {
      chunks.push(part);
      continue;
    }
    chunks.push(
      ...part
        .split(/\n{2,}|\n(?=\d+\.\s)/)
        .map((para) => para.replace(/\n/g, " ").trim())
        .filter(Boolean)
    );
  }
  return chunks;
}

const PAPER_LISTING_KEY_ONLY = /^\(\s*\d+\s*\)$/;

function paperContentLines(raw: string): string[] {
  const lines = raw
    .replace(CROP_FIG_TOKEN, "")
    .replace(LITERAL_NEWLINE, "\n")
    .split("\n")
    .map((line) => line.replace(PAPER_LISTING_PREFIX, "").trim())
    .filter((line) => line.length > 0 && !WATERMARK_LINE.test(line));
  while (lines.length && PAPER_LISTING_KEY_ONLY.test(lines[0])) {
    lines.shift();
  }
  return lines;
}

function paperLineClass(line: string): string {
  if (/^\$[^$]+\$\s*$/.test(line) || /^<img\b/i.test(line)) {
    return "nta-sol-paper-eq nta-math-plain";
  }
  return "nta-sol-paper-label nta-math-plain";
}

const PAPER_HEADING = /^##\s+(Step\s+\d+:\s+.+)$/i;
const MATH_ONLY = /^\$([^$]+)\$\s*[.]?\s*$/;
const LEAD_THEN_MATH = /^([^$]+?)\s+\$([^$]+)\$\s*$/;
const PAPER_STACKED_ENV = /\\begin\{(cases|array|aligned|pmatrix)\}/;
const NEW_THOUGHT =
  /^(First integral|Second integral|Applying|By parts|By IBP|Let\b|Using\b|Therefore|Thus|Hence|So\b|Total\b|Zeros in|Expression|From\b|Adding|Expanding|Setting|In\b|This\b|Calculating|Differentiating|Integrating|We\b|For\b|Then\b|Now\b|Here\b|Given|Split\b)/i;
const CONNECTIVE_TAIL =
  /(?:negative on|positive on|and|where|then|so|i\.e\.|giving|gives|from|to get|\bto|which|we need|or|plus|substitute)\s*$/i;
/** Printed above a display line, never glued onto the integral. */
const METHOD_ABOVE =
  /^(By IBP:?|By parts:?|Applying King(?: Rule)?|Differentiating:?|We can verify:?)\s*$/i;
const METHOD_THEN_MATH =
  /^(By IBP:?|By parts:?|Applying King(?: Rule)?|Differentiating:?)\s+(\$.+)$/i;

function mathOnlyTex(piece: string): string | null {
  const match = piece.match(MATH_ONLY);
  return match ? match[1]! : null;
}

function tidyPaperGlue(text: string): string {
  return text
    .split(/(\$[^$]+\$)/)
    .map((part, index, parts) => {
      if (index === 0) return part;
      const prev = parts[index - 1]!;
      if (part.startsWith("$") && /[A-Za-z,;:]$/.test(prev)) {
        return ` ${part}`;
      }
      if (prev.startsWith("$") && prev.endsWith("$") && /^[A-Za-z(]/.test(part)) {
        return ` ${part}`;
      }
      return part;
    })
    .join("");
}

function peelNewThoughts(line: string): string[] {
  const match = line.match(/^(.*?)\.\s+(.+)$/);
  if (!match) return [line];
  const rest = match[2]!.trim();
  if (!NEW_THOUGHT.test(rest)) return [line];
  const core = match[1]!.trim();
  if (!core) return [line];
  return [core, ...peelNewThoughts(rest)];
}

function isLeadIn(line: string): boolean {
  if (!line || /\$/.test(line) || /^<img\b/i.test(line) || /^\[\[fig:/.test(line)) {
    return false;
  }
  if (line.length > 80) return false;
  if (/[.!?]$/.test(line) && !/:$/.test(line)) return false;
  if (/:$/.test(line)) return true;
  if (line.split(/\s+/).length <= 6) return true;
  return NEW_THOUGHT.test(line);
}

function endsWithConnective(line: string): boolean {
  return CONNECTIVE_TAIL.test(line) || /,\s*$/.test(line);
}

function shouldJoinPaper(prev: string, next: string): boolean {
  if (/^<img\b/i.test(prev) || /^<img\b/i.test(next)) return false;
  if (!/\$/.test(next)) return false;
  if (METHOD_ABOVE.test(prev.trim())) return false;
  return isLeadIn(prev) || endsWithConnective(prev);
}

function peelMethodFromMath(line: string): string[] {
  const match = line.match(METHOD_THEN_MATH);
  if (!match) return [line];
  return [match[1]!.trim(), match[2]!.trim()];
}

function coalescePaperLines(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    if (out.length > 0 && shouldJoinPaper(out[out.length - 1]!, line)) {
      out[out.length - 1] = tidyPaperGlue(`${out[out.length - 1]!.trimEnd()} ${line.trimStart()}`);
      continue;
    }
    out.push(tidyPaperGlue(line));
  }
  return out;
}

function isMathOnlyLine(line: string): boolean {
  return mathOnlyTex(line.trim()) !== null;
}

/** A printed sentence that was stored as several broken lines. A full equation stays on its own line. */
function sentenceStillOpen(line: string): boolean {
  const text = line.trim();
  if (!text || /^<img\b/i.test(text) || /^\[\[fig:/.test(text)) return false;
  if (METHOD_ABOVE.test(text) || isMathOnlyLine(text)) return false;
  return !/[.?!]\s*$/.test(text);
}

function coalesceBrokenSentences(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    const prev = out.length > 0 ? out[out.length - 1]! : "";
    const fig = /^<img\b/i.test(line) || /^\[\[fig:/.test(line);
    if (prev && sentenceStillOpen(prev) && !fig && !isMathOnlyLine(line)) {
      out[out.length - 1] = tidyPaperGlue(`${prev.trimEnd()} ${line.trimStart()}`);
      continue;
    }
    out.push(tidyPaperGlue(line));
  }
  return out;
}

function shapePaperLines(lines: string[]): string[] {
  return coalesceBrokenSentences(
    coalescePaperLines(lines.flatMap(peelNewThoughts)).flatMap(peelMethodFromMath)
  );
}

function moveOrphanLeads(steps: { title: string; lines: string[] }[]): void {
  for (let i = 0; i < steps.length - 1; i += 1) {
    const lines = steps[i]!.lines;
    while (lines.length > 0) {
      const last = lines[lines.length - 1]!;
      if (!isLeadIn(last)) break;
      lines.pop();
      steps[i + 1]!.lines.unshift(last);
    }
  }
}

function renderPaperLineHtml(line: string, className: string, boxed: boolean): string {
  if (/^<img\b/i.test(line)) {
    return `<p class="${className}">${solutionInlineHtml(line)}</p>`;
  }
  const tex = mathOnlyTex(line);
  if (tex) {
    const display = `$$${tex}$$`;
    const inner = boxed
      ? `<span class="nta-paper-final">${solutionInlineHtml(display)}</span>`
      : solutionInlineHtml(display);
    return `<p class="${className}">${inner}</p>`;
  }
  const mixed = line.match(LEAD_THEN_MATH);
  if (mixed && PAPER_STACKED_ENV.test(mixed[2]!)) {
    const lead = mixed[1]!.trim().replace(/[\\{}$]/g, "");
    const body = mixed[2]!;
    return (
      `<p class="nta-paper-piecewise nta-math-plain">` +
      solutionInlineHtml(`$$\\text{${lead} }${body}$$`) +
      `</p>`
    );
  }
  return `<p class="${className}">${solutionInlineHtml(line)}</p>`;
}

function paperStepBodyHtml(
  lines: string[],
  links: PyqFigureLinkRow[] | null | undefined,
  folder: PyqFigureFolder,
  markFinal: boolean
): string {
  const resolved = lines.flatMap((line) => {
    const html = /\[\[fig:/.test(line)
      ? resolvePyqFigureHtml(line, links, folder, { appendUnused: false, roles: SOLUTION_FIGURE_ROLES }).trim()
      : line;
    return html ? [html] : [];
  });
  const shaped = shapePaperLines(resolved);
  let lastMath = -1;
  if (markFinal) {
    for (let i = shaped.length - 1; i >= 0; i -= 1) {
      const tex = mathOnlyTex(shaped[i]!);
      if (!tex) continue;
      if (!tex.includes("\\boxed")) lastMath = i;
      break;
    }
  }
  return shaped
    .map((line, index) => renderPaperLineHtml(line, "nta-math-plain", index === lastMath))
    .join("");
}

function paperStepsToHtml(
  raw: string,
  links: PyqFigureLinkRow[] | null | undefined,
  folder: PyqFigureFolder
): string | null {
  const lines = paperContentLines(raw);
  if (!lines.some((line) => PAPER_HEADING.test(line))) return null;

  const steps: { title: string; lines: string[] }[] = [];
  for (const line of lines) {
    const heading = line.match(PAPER_HEADING);
    if (heading) {
      steps.push({ title: heading[1]!.trim(), lines: [] });
      continue;
    }
    if (steps.length === 0) {
      steps.push({ title: "Step 1: Solution", lines: [] });
    }
    steps[steps.length - 1]!.lines.push(line);
  }
  const filled = steps.filter((step) => step.lines.length > 0);
  if (filled.length === 0) return null;
  for (const step of filled) {
    step.lines = step.lines.flatMap(peelNewThoughts);
  }
  moveOrphanLeads(filled);

  return (
    `<div class="nta-paper-steps">` +
    filled
      .map((step, index) => {
        const last = index === filled.length - 1;
        return (
          `<div class="nta-paper-step">` +
          `<span class="nta-paper-step-label">${escapeHtmlTextNode(step.title)}</span>` +
          `<div class="nta-paper-step-body nta-math-plain">${paperStepBodyHtml(step.lines, links, folder, last)}</div>` +
          `</div>`
        );
      })
      .join("") +
    `</div>`
  );
}

function paperSolutionToHtml(
  raw: string,
  links: PyqFigureLinkRow[] | null | undefined,
  folder: PyqFigureFolder
): string {
  const stepped = paperStepsToHtml(raw, links, folder);
  if (stepped) return stepped;
  const lines = paperContentLines(raw);
  return shapePaperLines(lines)
    .map((line) => {
      const resolved = /\[\[fig:/.test(line)
        ? resolvePyqFigureHtml(line, links, folder, { appendUnused: false, roles: SOLUTION_FIGURE_ROLES }).trim()
        : line;
      if (!resolved) return "";
      return renderPaperLineHtml(resolved, paperLineClass(resolved), false);
    })
    .join("");
}

/** Phase JSON (glm sheet) → the same stacked step cards as an enriched markdown solution. */
function workedSolutionToHtml(
  raw: string,
  links: PyqFigureLinkRow[] | null | undefined,
  folder: PyqFigureFolder
): string {
  const parsed = parsePyqWorkedSolution(raw);
  if (!parsed) return "";
  const steps = parsed.phases.map((phase) => ({
    title: phase.title,
    lines: phase.blocks.flatMap((block): string[] => {
      switch (block.kind) {
        case "paragraph":
          return block.text ? [block.text] : [];
        case "callout": {
          const text = block.text.trim();
          const tex = block.tex.trim();
          if (text && tex) return [`${text} $${tex}$`];
          if (text) return [text];
          return tex ? [`$$${tex}$$`] : [];
        }
        case "display":
          return block.tex ? [`$$${block.tex}$$`] : [];
        case "grid":
          return block.cells
            .filter((cell) => cell.tex.trim().length > 0)
            .map((cell) => (cell.label ? `${cell.label}: $${cell.tex}$` : `$${cell.tex}$`));
        default:
          return [];
      }
    }),
  }));
  const filled = steps.filter((step) => step.lines.length > 0);
  if (filled.length === 0) return "";
  return (
    `<div class="nta-paper-steps">` +
    filled
      .map((step, index) => {
        const last = index === filled.length - 1;
        return (
          `<div class="nta-paper-step">` +
          `<span class="nta-paper-step-label">${escapeHtmlTextNode(step.title)}</span>` +
          `<div class="nta-paper-step-body nta-math-plain">${paperStepBodyHtml(step.lines, links, folder, last)}</div>` +
          `</div>`
        );
      })
      .join("") +
    `</div>`
  );
}

export function pyqSolutionToHtml(
  md: string,
  links: PyqFigureLinkRow[] | null | undefined = [],
  folder: PyqFigureFolder = "physics/figures"
): string {
  const source = String(md ?? "").replace(/\r\n/g, "\n");
  const isPaper = /<!--\s*paper-ocr\s*-->/.test(source);
  const trimmedSource = source.replace(PAPER_OCR_MARK, "").trim();
  if (trimmedSource.startsWith("{")) {
    const worked = workedSolutionToHtml(trimmedSource, links, folder);
    if (worked) return worked;
  }
  const raw = unicodeMathToLatex(trimmedSource);
  if (!raw) return "";
  if (isPaper) {
    return paperSolutionToHtml(raw, links, folder);
  }
  const chunks = splitSolutionChunks(raw).map((chunk) =>
    /\[\[fig:/.test(chunk)
      ? resolvePyqFigureHtml(chunk, links, folder, { appendUnused: false, roles: SOLUTION_FIGURE_ROLES }).trim()
      : chunk
  ).filter(Boolean);

  const leads: string[] = [];
  const steps: { n: string; body: string }[] = [];
  for (const chunk of chunks) {
    const match = chunk.match(SOLUTION_STEP);
    if (match && !/^<img\b/i.test(chunk)) {
      steps.push({ n: match[1]!, body: chunk.slice(match[0].length).trim() });
      continue;
    }
    if (steps.length === 0) {
      leads.push(chunk);
      continue;
    }
    const last = steps[steps.length - 1]!;
    last.body = `${last.body} ${chunk}`.trim();
  }

  const leadHtml = leads
    .map((para) => `<p class="nta-sol-lead nta-math-plain">${solutionInlineHtml(para)}</p>`)
    .join("");
  if (steps.length === 0) {
    return (
      leadHtml ||
      chunks
        .map((para) => `<p class="nta-sol-lead nta-math-plain">${solutionInlineHtml(para)}</p>`)
        .join("")
    );
  }
  const items = steps
    .map((step, index) => {
      const end = index === steps.length - 1 ? " nta-sol-step--end" : "";
      return (
        `<li class="nta-sol-step${end}">` +
        `<span class="nta-sol-n">${escapeHtmlTextNode(step.n)}</span>` +
        `<div class="nta-sol-copy nta-math-plain">${solutionInlineHtml(step.body)}</div>` +
        `</li>`
      );
    })
    .join("");
  return `${leadHtml}<ol class="nta-sol">${items}</ol>`;
}
