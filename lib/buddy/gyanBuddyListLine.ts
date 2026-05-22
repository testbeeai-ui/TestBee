import { normalizePastedMathForDoubt } from "@/lib/normalizePastedDoubtMath";

/** KaTeX-friendly preview for Right now (inline math so 2-line clamp works). */
export function gyanRightNowPreviewContent(title: string): string {
  let s = normalizePastedMathForDoubt((title ?? "").trim());
  if (!s) return "New doubt on Gyan++";
  s = s.replace(/\$\$\s*([\s\S]*?)\s*\$\$/g, (_m, inner: string) => {
    const t = String(inner).trim().replace(/\n+/g, " ");
    return `$${t}$`;
  });
  return s.replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * One-line plain preview for Learning Buddy Recent Gyan++ list (no KaTeX block layout).
 */
export function gyanBuddyListLine(title: string, max = 52): string {
  let t = (title ?? "").replace(/\r\n/g, " ").trim();
  if (!t) return "Gyan++ activity";

  t = t.replace(/\*\*([^*]+)\*\*/g, "$1");
  t = t.replace(/__([^_]+)__/g, "$1");
  t = t.replace(/`([^`]+)`/g, "$1");

  t = t.replace(/\$\$([\s\S]*?)\$\$/g, (_m, inner: string) => latexToPlain(inner));
  t = t.replace(/\$([^$\n]+)\$/g, (_m, inner: string) => latexToPlain(inner));
  t = t.replace(/\\\[([\s\S]*?)\\\]/g, (_m, inner: string) => latexToPlain(inner));
  t = t.replace(/\\\(([\s\S]*?)\\\)/g, (_m, inner: string) => latexToPlain(inner));

  t = t.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function latexToPlain(inner: string): string {
  return inner
    .replace(/\\%/g, "%")
    .replace(/\\sqrt\{([^}]*)\}/g, "√($1)")
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, "$1/$2")
    .replace(/\\[a-zA-Z]+/g, " ")
    .replace(/[{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
