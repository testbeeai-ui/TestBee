/**
 * Turn common copy-paste shapes (notes, web, LaTeX-style text) into markdown KaTeX can parse
 * ($…$ inline, $$…$$ display). remark-math is dollar-centric; LLMs often emit \[ \] / \( \) / fenced blocks.
 */
export function normalizePastedMathForDoubt(raw: string): string {
  let s = raw.replace(/\r\n/g, "\n");

  // ```latex / ```tex / ```math … ``` → display math
  s = s.replace(/^```(?:latex|tex|math)\s*\n([\s\S]*?)\n```/gim, (_m, inner: string) => {
    const t = String(inner).trim();
    return `\n\n$$\n${t}\n$$\n\n`;
  });

  // \[ … \] display (multiline)
  s = s.replace(/\\\[([\s\S]*?)\\\]/g, (_m, inner: string) => {
    const t = String(inner).trim();
    return `\n\n$$\n${t}\n$$\n\n`;
  });

  // \( … \) inline
  s = s.replace(/\\\(([\s\S]*?)\\\)/g, (_m, inner: string) => {
    const t = String(inner).trim().replace(/\n+/g, " ");
    return `$${t}$`;
  });

  // Collapse extra blank lines from conversions
  return s.replace(/\n{3,}/g, "\n\n").trim();
}

/** Insert clipboard text into a controlled field, applying {@link normalizePastedMathForDoubt}. */
export function applyNormalizedPasteToField(
  current: string,
  selectionStart: number,
  selectionEnd: number,
  pastedPlain: string,
): { value: string; caret: number } {
  const normalized = pastedPlain === "" ? "" : normalizePastedMathForDoubt(pastedPlain);
  const value = current.slice(0, selectionStart) + normalized + current.slice(selectionEnd);
  const caret = selectionStart + normalized.length;
  return { value, caret };
}
