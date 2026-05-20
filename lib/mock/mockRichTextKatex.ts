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
  return patchMockHtmlImages(html.replace(/<\/span>([a-z])/gi, "</span> $1"));
}

const TESTBEE_QIMAGE_RE =
  /^https?:\/\/(?:www\.)?testbee\.in\/preview\/show_qimage\/[a-zA-Z0-9._-]+\.(?:png|jpe?g|gif|webp)$/i;

/** Normalize legacy bank `<img>` tags (trim src, proxy testbee.in, responsive class). */
export function patchMockHtmlImages(html: string): string {
  return html.replace(/<img\b([^>]*)\/?>/gi, (_full, rawAttrs: string) => {
    const srcMatch = rawAttrs.match(/\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
    let src = (srcMatch?.[1] ?? srcMatch?.[2] ?? "").trim();
    if (!src) return _full;

    if (src.startsWith("//")) src = `https:${src}`;
    if (!/^https?:\/\//i.test(src)) src = `https://${src}`;
    src = src.replace(/^https:\/\/testbee\.in\//i, "https://www.testbee.in/");

    let attrs = rawAttrs.replace(/\bsrc\s*=\s*(?:"[^"]*"|'[^']*')/i, `src="${src}"`);

    if (!/\bclass\s*=/i.test(attrs)) {
      attrs += ' class="nta-mock-img"';
    } else if (!/\bnta-mock-img\b/.test(attrs)) {
      attrs = attrs.replace(/\bclass\s*=\s*"([^"]*)"/i, 'class="$1 nta-mock-img"');
    }
    if (!/\breferrerpolicy\s*=/i.test(attrs)) {
      attrs += ' referrerpolicy="no-referrer"';
    }
    if (!/\bloading\s*=/i.test(attrs)) {
      attrs += ' loading="lazy"';
    }
    if (!/\bdecoding\s*=/i.test(attrs)) {
      attrs += ' decoding="async"';
    }

    if (TESTBEE_QIMAGE_RE.test(src)) {
      attrs = attrs.replace(/\bsrc\s*=\s*"[^"]*"/i, `src="/api/mock/question-image?url=${encodeURIComponent(src)}"`);
    }

    return `<img${attrs}>`;
  });
}

/**
 * Repair common JEE/PYQ bank LaTeX typos before KaTeX (NTA exam + review UI).
 * Fixes `\lim_\limits{…}`, `\text x`, glued `\rightarrow1+`, broken `\frac`, etc.
 */
export function repairBankMathLatex(math: string): string {
  let s = normalizeBankMathEscapes(String(math ?? ""));
  s = s.replace(/\r?\n\s*/g, " ");
  s = s.replace(/\\text\s+\{/g, "\\text{");
  s = s.replace(/\\lim_\\limits\s*\{/g, "\\lim\\limits_{");
  s = s.replace(/\\lim_limits\b/g, "\\lim\\limits");
  s = s.replace(/\\text\s+([a-zA-Z])\b/g, "\\text{$1}");
  s = s.replace(/\\(mathrm|mathbf|mathit|operatorname)\s+([A-Za-z0-9]+)/g, "\\$1{$2}");
  s = s.replace(/\\(leftarrow|rightarrow)row\b/g, "\\$1");
  s = s.replace(/\\rightarrow\s*(\d)\s*\+/g, "\\to $1^{+}");
  s = s.replace(/\\rightarrow\s*(\d)\s*-/g, "\\to $1^{-}");
  s = s.replace(/\\rightarrow/g, "\\to ");
  s = s.replace(/\\uparrowrac\b/g, "\\frac");
  s = s.replace(/\\[A-Za-z^]*rac(?=\s*\{)/g, "\\frac");
  s = s.replace(/\u2212/g, "-");
  s = s.replace(/\u00D7/g, "\\times ");
  s = s.replace(/\u00B7/g, "\\cdot ");
  s = s.replace(/\s{2,}/g, " ");
  return s.trim();
}

/** Safe fragment: one paragraph KaTeX can scan for `\(` / `\[` / `$$`. */
export function wrapPlainMockTextForKatexHtml(plain: string): string {
  const raw = String(plain ?? "").trim();
  if (!raw) return "";
  const t = normalizeBankMathEscapes(decodeBankPlainEntities(raw));
  return `<p class="nta-math-plain">${escapeHtmlTextNode(t)}</p>`;
}
