/**
 * Wrap plain mock strings (no HTML tags) so KaTeX auto-render can run on a
 * single sanitized container — same path as Supabase `question_html` / option HTML.
 */

/** Fullwidth reverse solidus (＼) and similar → ASCII `\` so `\(` is recognized. */
export function normalizeBankMathEscapes(s: string): string {
  return s.replace(/\uFF3C/g, "\\");
}

/**
 * Banks often paste `&nbsp;`, `&hellip;`, etc. into **plain** option rows (no `<`).
 * If we escape `&` first, `&nbsp;` becomes `&amp;nbsp;` and the UI shows the literal `&nbsp;`.
 * Decode common entities to Unicode, then escape real `< > &` only.
 */
export function decodeBankPlainEntities(s: string): string {
  let t = String(s ?? "");
  for (let i = 0; i < 8; i++) {
    const next = t
      .replace(/&nbsp;/gi, "\u00A0")
      .replace(/&hellip;/gi, "\u2026")
      .replace(/&mdash;/gi, "\u2014")
      .replace(/&ndash;/gi, "\u2013")
      .replace(/&rsquo;|&#8217;/gi, "\u2019")
      .replace(/&lsquo;|&#8216;/gi, "\u2018")
      .replace(/&rdquo;|&#8221;/gi, "\u201D")
      .replace(/&ldquo;|&#8220;/gi, "\u201C")
      .replace(/&deg;/gi, "\u00B0")
      .replace(/&times;/gi, "\u00D7")
      .replace(/&middot;/gi, "\u00B7")
      .replace(/&#(\d{1,7});/g, (m, n) => {
        const code = Number(n);
        return Number.isFinite(code) && code >= 0 && code <= 0x10ffff
          ? String.fromCodePoint(code)
          : m;
      })
      .replace(/&#x([0-9a-f]{1,6});/gi, (m, h) => {
        const code = parseInt(h, 16);
        return Number.isFinite(code) && code >= 0 && code <= 0x10ffff
          ? String.fromCodePoint(code)
          : m;
      })
      .replace(/&amp;/g, "&");
    if (next === t) break;
    t = next;
  }
  return t;
}

/** Escape only characters that can break out of HTML text nodes. */
export function escapeHtmlTextNode(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Typo repair after sanitize: missing space between `</span>` and a following word. */
export function patchNtaHtmlPresentation(html: string): string {
  return html.replace(/<\/span>([a-z])/gi, "</span> $1");
}

/** Safe fragment: one paragraph KaTeX can scan for `\(` / `\[` / `$$`. */
export function wrapPlainMockTextForKatexHtml(plain: string): string {
  const raw = String(plain ?? "").trim();
  if (!raw) return "";
  const t = normalizeBankMathEscapes(decodeBankPlainEntities(raw));
  return `<p class="nta-math-plain">${escapeHtmlTextNode(t)}</p>`;
}
