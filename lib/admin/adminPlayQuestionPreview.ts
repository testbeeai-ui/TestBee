import type { PlayQuestionContent } from "@/types";

/** Markdown-ish source for stems (text + optional latex block). */
export function playQuestionStemMarkdownSource(content: unknown): string {
  if (content != null && typeof content === "object") {
    const o = content as PlayQuestionContent;
    const text = typeof o.text === "string" ? o.text.trim() : "";
    const latex = typeof o.latex === "string" ? o.latex.trim() : "";
    if (text && latex) return `${text}\n\n${latex}`;
    return text || latex;
  }
  if (typeof content === "string") return content;
  return "";
}

/** Single-line preview for dense tables (strip gross noise only). */
export function playQuestionStemPlain(content: unknown): string {
  const raw = playQuestionStemMarkdownSource(content);
  return raw.replace(/\s+/g, " ").trim();
}

export function parsePlayQuestionOptions(options: unknown): string[] {
  if (!Array.isArray(options)) return [];
  return options.map((x) => (typeof x === "string" ? x : String(x)));
}

export function truncatePlain(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

function stripLightMarkdown(s: string): string {
  return s
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
}

export function formatMcqChoiceLabel(
  index: number | null | undefined,
  options: string[],
  optSnippetMax = 72
): string {
  if (index == null || !Number.isFinite(index) || index < 0 || index >= options.length) {
    return "";
  }
  const letter = index < 26 ? String.fromCharCode(65 + index) : `#${index + 1}`;
  const snippet = truncatePlain(stripLightMarkdown(options[index] ?? ""), optSnippetMax);
  return snippet ? `${letter}: ${snippet}` : letter;
}

export function poolKeyLabel(poolKey: string | null | undefined): string | null {
  if (!poolKey?.trim()) return null;
  if (poolKey.endsWith("_gauntlet")) return "Daily Gauntlet";
  if (poolKey.endsWith("_all")) return "Streak / arena";
  return poolKey;
}
