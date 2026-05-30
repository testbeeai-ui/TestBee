/** True when bracketed text is likely LaTeX, not a markdown link/reference. */
function looksLikeLatexMath(inner: string): boolean {
  const t = inner.trim();
  if (!t) return false;
  if (/\]\s*\(/.test(t)) return false;
  if (
    /\\(?:frac|sqrt|sum|int|lim|cdot|times|alpha|beta|gamma|pi|theta|left|right|text|mathrm|mathbf|overline|underline|binom|displaystyle|begin|end)\b/i.test(
      t
    )
  )
    return true;
  if (/\\[a-zA-Z@*]+/.test(t)) return true;
  return /=/.test(t) && /[\^{}_]/.test(t);
}

/** KaTeX treats `%` as a comment in some positions; keep percent signs inside math. */
function escapePercentInMath(inner: string): string {
  return inner.replace(/(?<!\\)%/g, "\\%");
}

function toDisplayMath(inner: string): string {
  const t = escapePercentInMath(String(inner).trim());
  return `\n\n$$\n${t}\n$$\n\n`;
}

function toInlineMath(inner: string): string {
  const t = escapePercentInMath(String(inner).trim().replace(/\n+/g, " "));
  return `$${t}$`;
}

/**
 * Turn common copy-paste shapes (notes, web, LaTeX-style text) into markdown KaTeX can parse
 * ($…$ inline, $$…$$ display). remark-math is dollar-centric; LLMs often emit \[ \] / \( \) / fenced blocks.
 */
export function normalizePastedMathForDoubt(raw: string): string {
  let s = raw.replace(/\r\n/g, "\n");

  // ```latex / ```tex / ```math … ``` → display math
  s = s.replace(/^```(?:latex|tex|math)\s*\n([\s\S]*?)\n```/gim, (_m, inner: string) => {
    return toDisplayMath(inner);
  });

  // \[ … \] display (multiline)
  s = s.replace(/\\\[([\s\S]*?)\\\]/g, (_m, inner: string) => {
    return toDisplayMath(inner);
  });

  // \( … \) inline
  s = s.replace(/\\\(([\s\S]*?)\\\)/g, (_m, inner: string) => {
    return toInlineMath(inner);
  });

  // Standalone [ … ] on its own lines (notes / Word), not markdown links
  s = s.replace(/(?:^|\n)\s*\[\s*\n([\s\S]*?)\n\s*\]\s*/g, (_m, inner: string) => {
    if (!looksLikeLatexMath(inner)) return _m;
    return toDisplayMath(inner);
  });

  // Single-line [ … ] with LaTeX inside, e.g. [ x=\sqrt{10%} ]
  s = s.replace(/(?:^|\n)\s*\[\s*([^\]\n]+)\s*\]\s*(?=\n|$)/g, (match, inner: string) => {
    if (!looksLikeLatexMath(inner)) return match;
    return toDisplayMath(inner);
  });

  // Collapse extra blank lines from conversions
  return s.replace(/\n{3,}/g, "\n\n").trim();
}

/** Insert clipboard text into a controlled field, applying {@link normalizePastedMathForDoubt}. */
export function applyNormalizedPasteToField(
  current: string,
  selectionStart: number,
  selectionEnd: number,
  pastedPlain: string
): { value: string; caret: number } {
  const normalized = pastedPlain === "" ? "" : normalizePastedMathForDoubt(pastedPlain);
  const value = current.slice(0, selectionStart) + normalized + current.slice(selectionEnd);
  const caret = selectionStart + normalized.length;
  return { value, caret };
}
