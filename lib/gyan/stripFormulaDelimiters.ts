/**
 * JSON escape sequences can silently corrupt TeX commands when parsed:
 * - \frac -> form-feed + "rac"
 * - \theta -> tab + "heta"
 * - \nu -> newline + "u"
 * Recover those before sending to KaTeX.
 */
export function repairEscapedLatexCommands(input: string): string {
  const controlToEscape: Record<string, string> = {
    "\n": "n",
    "\r": "r",
    "\t": "t",
    "\f": "f",
    "\b": "b",
  };

  let out = String(input ?? "");
  out = out.replace(/[\n\r\t\f\b]+([A-Za-z]+)/g, (match, cmd: string) => {
    const ctrl = match[0] ?? "";
    const esc = controlToEscape[ctrl];
    if (!esc) return ` ${cmd}`;
    return `\\${esc}${cmd}`;
  });
  // Any leftover control chars become spaces (avoid KaTeX parse noise).
  out = out.replace(/[\x00-\x08\x0B\x0E-\x1F\x7F]/g, " ");
  return out;
}

/** Strip wrappers and repair common malformed TeX so KaTeX renders formula cards reliably. */
export function stripFormulaDelimiters(raw: string): string {
  let out = repairEscapedLatexCommands(String(raw ?? ""))
    .trim()
    .replace(/^\\?\$\\?\$([\s\S]*)\\?\$\\?\$$/, "$1")
    .replace(/^\$([\s\S]*)\$$/, "$1")
    .replace(/^\\\(([\s\S]*)\\\)$/, "$1")
    .replace(/^\\\[([\s\S]*)\\\]$/, "$1")
    .replace(/\\\$/g, "$")
    .replace(/^\s*\$\$+/g, "")
    .replace(/\$\$+\s*$/g, "")
    .trim();

  // Model output often escapes literal braces in denominator groups (\{...\}) which breaks display intent.
  out = out.replace(/\\\{/g, "{").replace(/\\\}/g, "}");
  // Occasionally Greek symbols arrive as escaped unicode letters (\θ, \τ) instead of TeX commands.
  out = out.replace(/\\θ/g, "\\theta").replace(/\\τ/g, "\\tau");
  // Keep common symbols resilient when command was partially dropped.
  out = out.replace(/\\bar\s*\{\s*\}/g, "\\bar{\\nu}");
  out = out.replace(/\\text\s*\{\s*\}/g, "\\text{ }");

  return out;
}
