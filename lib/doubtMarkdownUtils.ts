/**
 * Truncate text without splitting a single `$...$` inline math segment (common in AI answers).
 * Does not parse `$$` display blocks; extend later if needed.
 */
export function truncatePreservingInlineMath(text: string, maxLen: number): string {
  const t = text.trim();
  if (t.length <= maxLen) return t;
  let cut = maxLen;
  let parity = 0;
  for (let i = 0; i < cut; i++) {
    const c = t[i];
    if (c === "$" && t[i - 1] !== "\\") parity ^= 1;
  }
  if (parity === 1) {
    const close = t.indexOf("$", cut);
    if (close !== -1) cut = close + 1;
    else {
      const open = t.lastIndexOf("$", cut - 1);
      if (open !== -1) cut = open;
    }
  }
  let out = t.slice(0, cut).trimEnd();
  if (out.length < t.length) out += "…";
  return out;
}
