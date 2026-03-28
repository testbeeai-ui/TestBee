/** Strip common $…$, $$…$$, \(…\) wrappers so MathText / KaTeX receives plain TeX. */
export function stripFormulaDelimiters(raw: string): string {
  return String(raw ?? "")
    .trim()
    .replace(/^\\?\$\\?\$([\s\S]*)\\?\$\\?\$$/, "$1")
    .replace(/^\$([\s\S]*)\$$/, "$1")
    .replace(/^\\\(([\s\S]*)\\\)$/, "$1")
    .replace(/^\\\[([\s\S]*)\\\]$/, "$1")
    .replace(/\\\$/g, "$")
    .replace(/^\s*\$\$+/g, "")
    .replace(/\$\$+\s*$/g, "")
    .trim();
}
