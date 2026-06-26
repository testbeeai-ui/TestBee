/** Normalize InstaCue / revision card text for MathText + KaTeX rendering. */
export function normalizeTrigNotation(raw: string): string {
  let out = raw;
  const trigMap: Record<string, string> = {
    sin: "\\sin",
    cos: "\\cos",
    tan: "\\tan",
    cot: "\\cot",
    sec: "\\sec",
    cosec: "\\csc",
    csc: "\\csc",
  };

  out = out.replace(/\b(sin|cos|tan|cot|sec|cosec|csc)\s*\^\s*-?1\s*x\b/gi, (_m, fn: string) => {
    const key = fn.toLowerCase();
    return `${trigMap[key] ?? `\\${key}`}^{-1}x`;
  });

  out = out.replace(/\bpi\b/gi, "\\pi");
  out = out.replace(/\\?ext\{/g, "\\text{");
  out = out.replace(/\\frac\\pi\{2\}/g, "\\frac{\\pi}{2}");
  return out;
}

export function normalizeCardMath(raw: string, wrapInlineMath = false): string {
  let out = raw ?? "";
  out = out
    .replace(/\\\\\(/g, "\\(")
    .replace(/\\\\\)/g, "\\)")
    .replace(/\\\\\[/g, "\\[")
    .replace(/\\\\\]/g, "\\]");
  out = normalizeTrigNotation(out);
  if (
    wrapInlineMath &&
    !/\\\(|\\\[|\$/.test(out) &&
    /\\(sin|cos|tan|cot|sec|csc)|\\pi|=/.test(out)
  ) {
    out = `\\(${out}\\)`;
  }
  return out;
}
