/**
 * Play / adaptive question stems sometimes arrive with prose jammed inside `$...$`
 * or with spaces stripped (KaTeX math mode collapses spaces → unreadable).
 * Repair before MathText so chunks parse and prose heuristics work.
 */

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
  return text.replace(/\$\$([^$]+)\$\$/g, (_, inner: string) => {
    const x = repairGluedWordsInString(String(inner));
    return `$$${x}$$`;
  }).replace(/\$([^$\n]+?)\$/g, (_, inner: string) => {
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

/** Full pipeline for stems shown in PlayQuestionCard / InlineRdmChallenge. */
export function formatPlayQuestionStemForDisplay(text: string): string {
  const s = String(text ?? "").trim();
  if (!s) return s;
  return repairPlayQuestionDollarSegments(unicodePowToTeX(s));
}
