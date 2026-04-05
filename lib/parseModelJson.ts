/**
 * Shared JSON repair + parse for Gemini / Vertex structured outputs that break JSON.parse
 * (LaTeX backslashes, invalid \\u escapes, markdown fences, trailing prose).
 */

export function tryParseJsonObject(raw: string): Record<string, unknown> | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;

  const directCandidates = [
    text,
    text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim(),
  ];
  for (const candidate of directCandidates) {
    if (!candidate) continue;
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
    } catch {
      /* try next */
    }
  }

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const sliced = text.slice(start, end + 1);
    try {
      const parsed = JSON.parse(sliced) as unknown;
      if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return null;
}

/** Escape stray LaTeX backslashes so JSON.parse can succeed. */
export function salvageJsonForLatex(raw: string): string {
  return raw.replace(/\\(?!["\\/bfnrtu])/g, "\\\\");
}

/** `\u` must be followed by 4 hex digits; models sometimes emit broken Unicode escapes. */
export function repairInvalidJsonUnicodeEscapes(s: string): string {
  return s.replace(/\\u(?![0-9a-fA-F]{4})/g, "\\\\u");
}

/** Try multiple repairs before giving up. */
export function tryParseJsonObjectWithSalvage(raw: string): Record<string, unknown> | null {
  const trimmed = String(raw ?? "").trim();
  const variants = [
    trimmed,
    repairInvalidJsonUnicodeEscapes(trimmed),
    salvageJsonForLatex(trimmed),
    salvageJsonForLatex(repairInvalidJsonUnicodeEscapes(trimmed)),
  ];
  const seen = new Set<string>();
  for (const v of variants) {
    if (!v || seen.has(v)) continue;
    seen.add(v);
    const p = tryParseJsonObject(v);
    if (p) return p;
  }
  return null;
}
