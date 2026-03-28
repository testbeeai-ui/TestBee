/**
 * Subtopic names from curriculum sometimes include LaTeX (bad for titles and URL slugs).
 * Content APIs still use the exact DB string; these helpers only affect display and routing segments.
 */

import { slugify } from "@/lib/slugs";

/** True when the string looks like it contains LaTeX commands (\frac, \text, …). */
export function subtopicNameHasLatexCommands(name: string): boolean {
  return /\\[a-zA-Z]/.test(String(name ?? ""));
}

/**
 * Plain-language title: text before the first LaTeX command, trimmed.
 * Formulas belong in lesson body, not in navigation labels.
 */
export function humanReadableSubtopicTitle(raw: string): string {
  let s = String(raw ?? "").trim();
  if (!s) return "";
  s = s.replace(/[\u200B-\u200D\u2060\uFEFF]/g, "");

  const latexStart = s.search(/\\[a-zA-Z]/);
  if (latexStart >= 0) {
    s = s.slice(0, latexStart).trim();
  }

  s = s.replace(/[{}]/g, "").replace(/\s+/g, " ").trim();
  s = s.replace(/[:;,\s]+$/g, "").trim();

  if (!s) {
    s = String(raw ?? "").trim();
    s = s.replace(/\\[a-zA-Z]+(\[[^\]]*\])?(\{[^{}]*\})?/g, " ");
    s = s.replace(/[{}^_]/g, " ");
    s = s.replace(/\s+/g, " ").trim();
  }

  return s;
}

/** Heading line under chapter (Deep Dive breadcrumb, dialogs). */
export function displaySubtopicHeading(raw: string): string {
  const h = humanReadableSubtopicTitle(raw);
  return h || String(raw ?? "").trim();
}

/**
 * URL segment for a subtopic: short slug when the name was LaTeX-heavy; otherwise same as slugify(name).
 */
export function subtopicSlugForRouting(subtopicName: string): string {
  const full = slugify(subtopicName);
  if (!subtopicNameHasLatexCommands(subtopicName)) {
    return full;
  }
  const short = slugify(humanReadableSubtopicTitle(subtopicName));
  return short.length > 0 ? short : full;
}
