/**
 * Post-process Prof-Pi markdown to fix common Indic-script + LaTeX rendering artifacts.
 * Safe to run server-side (before save/CAS) and client-side (DoubtMarkdown safety net).
 */

const INDIC_SCRIPT_RE = /[\u0900-\u097F\u0C00-\u0C7F\u0C80-\u0CFF\u0B80-\u0BFF]/;

/** Split text into alternating [prose, math, prose, …] where math is $…$ or $$…$$. */
const MATH_SEGMENT_RE = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g;

const SUPERSCRIPT_MAP: Record<string, string> = {
  "⁰": "^0",
  "¹": "^1",
  "²": "^2",
  "³": "^3",
  "⁴": "^4",
  "⁵": "^5",
  "⁶": "^6",
  "⁷": "^7",
  "⁸": "^8",
  "⁹": "^9",
  "⁻": "^-",
  "⁺": "^+",
};

const SUBSCRIPT_MAP: Record<string, string> = {
  "₀": "_0",
  "₁": "_1",
  "₂": "_2",
  "₃": "_3",
  "₄": "_4",
  "₅": "_5",
  "₆": "_6",
  "₇": "_7",
  "₈": "_8",
  "₉": "_9",
};

function looksLikeMathFragment(fragment: string): boolean {
  const t = fragment.trim();
  if (t.length < 4) return false;
  return /[=²³⁴⁵⁶⁷⁸⁹⁰⁻⁺√∫Δ\\$^_+\-*/()]/.test(t) && /\d|[a-zA-ZΔ]/.test(t);
}

/** Remove consecutive duplicate math blocks ($…$ or $$…$$). */
function dedupeConsecutiveMathBlocks(text: string): string {
  let out = text;
  out = out.replace(/(\$\$[\s\S]+?\$\$)(\s+\1)+/g, "$1");
  out = out.replace(/(\$[^$\n]+?\$)(\s+\1)+/g, "$1");
  return out;
}

/** Remove back-to-back duplicate raw formula fragments (LLM token-split artifact). */
function dedupeConsecutiveMathFragments(text: string): string {
  return text.replace(/(.{4,80}?)\s+\1/g, (match, frag: string) => {
    return looksLikeMathFragment(frag) ? frag : match;
  });
}

/** Ensure a space between Indic script and $ delimiters. */
function spaceIndicAroundDollars(text: string): string {
  return text
    .replace(
      /([\u0900-\u097F\u0C00-\u0C7F\u0C80-\u0CFF\u0B80-\u0BFF]+[:;,.!?]*)(\$)/g,
      "$1 $2"
    )
    .replace(/(\$)([\u0900-\u097F\u0C00-\u0C7F\u0C80-\u0CFF\u0B80-\u0BFF]+)/g, "$1 $2");
}

/** Wrap letter+superscript (e.g. x²) in inline math when outside $ blocks. */
function wrapSuperscriptVars(prose: string): string {
  return prose.replace(
    /([a-zA-Z])([⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺]+)/g,
    (_m, letter: string, sup: string) => {
      let exp = "";
      for (const ch of sup) {
        exp += SUPERSCRIPT_MAP[ch] ?? ch;
      }
      return `$${letter}${exp}$`;
    }
  );
}

/** Wrap simple subscript patterns (e.g. x₁) in inline math. */
function wrapSubscriptVars(prose: string): string {
  return prose.replace(/([a-zA-Z])([₀₁₂₃₄₅₆₇₈₉]+)/g, (_m, letter: string, sub: string) => {
    let suffix = "";
    for (const ch of sub) {
      suffix += SUBSCRIPT_MAP[ch] ?? ch;
    }
    return `$${letter}${suffix}$`;
  });
}

/** Convert isolated Unicode math symbols in prose to inline LaTeX. */
function unicodeMathToLatex(prose: string): string {
  let s = prose;
  // Standalone Δ before = or in formula-like runs
  s = s.replace(/(?<!\$)\bΔ\s*=/g, "$\\Delta$ =");
  // √ followed by parenthesized or short token
  s = s.replace(/(?<!\$)√\s*\(([^)]+)\)/g, (_m, inner: string) => `$\\sqrt{${inner.trim()}}$`);
  s = s.replace(/(?<!\$)√\s*([a-zA-Z0-9]+)/g, (_m, inner: string) => `$\\sqrt{${inner}}$`);
  // Minus sign variants in formula-like runs (digit/letter − digit/letter)
  s = s.replace(/([\w)\]}])\s*−\s*([\w(\[{])/g, "$1 - $2");
  // Multiplication × between tokens
  s = s.replace(/([\w)\]}])\s*×\s*([\w(\[{])/g, "$1 \\times $2");
  return s;
}

function processProseSegment(prose: string): string {
  let s = prose;
  s = wrapSuperscriptVars(s);
  s = wrapSubscriptVars(s);
  s = unicodeMathToLatex(s);
  return s;
}

function processOutsideMath(text: string): string {
  const parts = text.split(MATH_SEGMENT_RE);
  return parts
    .map((part) => {
      if (part.startsWith("$")) return part;
      return processProseSegment(part);
    })
    .join("");
}

/**
 * Clean Prof-Pi markdown for mixed Indic-script + LaTeX display.
 * Idempotent on well-formed English answers; no-op when text is empty.
 */
export function sanitizeProfPiMultilingualOutput(raw: string): string {
  if (!raw?.trim()) return raw ?? "";

  let out = raw.replace(/\r\n/g, "\n");
  out = dedupeConsecutiveMathBlocks(out);
  out = dedupeConsecutiveMathFragments(out);
  out = processOutsideMath(out);
  if (INDIC_SCRIPT_RE.test(out)) {
    out = spaceIndicAroundDollars(out);
  }
  return out.trim();
}
