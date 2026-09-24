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

/**
 * Bank HTML often pads after figures with dozens of `<br>` / `&nbsp;` (OCR paste junk).
 * That creates a huge empty gap above the options in the NTA exam UI.
 */
export function collapseSpuriousMockHtmlWhitespace(html: string): string {
  let s = String(html ?? "");
  if (!s) return s;

  s = s.replace(/<br\s*\/?>/gi, "<br>");
  s = s.replace(/(?:<br>\s*){2,}/gi, "<br>");

  // Drop block elements that have no visible text (only nbsp / br / empty wrappers).
  // Keep blocks that contain media — `<img>` has no text content.
  const stripVisible = (fragment: string) =>
    fragment
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/gi, "")
      .replace(/\u00a0/g, "")
      .replace(/\s+/g, "");

  s = s.replace(/<(p|div)(\s[^>]*)?>[\s\S]*?<\/\1>/gi, (block) => {
    if (/<img\b/i.test(block)) return block;
    return stripVisible(block).length === 0 ? "" : block;
  });

  // Trailing spacer after the last <img> inside an otherwise-real paragraph
  s = s.replace(/(<img\b[^>]*>)(?:\s|&nbsp;|\u00a0|<br>)+/gi, "$1");
  s = s.replace(/(?:&nbsp;|\u00a0){2,}/gi, " ");
  s = s.replace(/[ \t]{3,}/g, " ");
  s = s.replace(/(?:\r?\n\s*){3,}/g, "\n\n");
  return s.trim();
}

/** Typo repair after sanitize: missing space between `</span>` and a following word. */
export function patchNtaHtmlPresentation(html: string): string {
  return patchMockHtmlImages(
    collapseSpuriousMockHtmlWhitespace(html.replace(/<\/span>([a-z])/gi, "</span> $1"))
  );
}

const TESTBEE_QIMAGE_RE =
  /^https?:\/\/(?:www\.)?testbee\.in\/preview\/show_qimage\/[a-zA-Z0-9._-]+\.(?:png|jpe?g|gif|webp)$/i;

/**
 * First-party Supabase Storage public objects — Chapter PYQ figures live at
 * `pyq/physics/figures/`. These are served directly: they are our own origin,
 * so the `/api/mock/question-image` proxy (which exists only to work around
 * Testbee's hotlink behaviour) must not swallow them.
 */
export const SUPABASE_PUBLIC_OBJECT_RE =
  /^https?:\/\/(?:[a-z0-9-]+\.supabase\.co|127\.0\.0\.1(?::\d+)?|localhost(?::\d+)?)\/storage\/v1\/object\/public\/[A-Za-z0-9._~/-]+\.(?:png|jpe?g|gif|webp)$/i;

/** Normalize legacy bank `<img>` tags (trim src, proxy testbee.in, responsive class). */
export function patchMockHtmlImages(html: string): string {
  return html.replace(/<img\b([^>]*)\/?>/gi, (_full, rawAttrs: string) => {
    const srcMatch = rawAttrs.match(/\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
    let src = (srcMatch?.[1] ?? srcMatch?.[2] ?? "").trim();
    if (!src) return _full;

    const isSupabaseObject = SUPABASE_PUBLIC_OBJECT_RE.test(src);
    if (!isSupabaseObject) {
      if (src.startsWith("//")) src = `https:${src}`;
      if (!/^https?:\/\//i.test(src)) src = `https://${src}`;
      src = src.replace(/^https:\/\/testbee\.in\//i, "https://www.testbee.in/");
    }

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
      attrs = attrs.replace(
        /\bsrc\s*=\s*"[^"]*"/i,
        `src="/api/mock/question-image?url=${encodeURIComponent(src)}"`
      );
    }

    return `<img${attrs}>`;
  });
}

function unescapedBraceDepth(tex: string): number {
  let depth = 0;
  for (let i = 0; i < tex.length; i += 1) {
    if (tex[i] === "\\") {
      i += 1;
      continue;
    }
    if (tex[i] === "{") depth += 1;
    else if (tex[i] === "}") depth -= 1;
  }
  return depth;
}

function closeBareSetBraces(tex: string): string {
  const holes: string[] = [];
  const stash = (chunk: string) => {
    holes.push(chunk);
    return `\u0001${holes.length - 1}\u0001`;
  };
  let s = String(tex ?? "");
  s = s.replace(/\\(?:left|right|bigl|bigr|Bigl|Bigr|big|Big)\s*\\\{/g, stash);
  s = s.replace(/\\\{((?:[^\\{}]|\\(?![{}]))*)\}/g, (_all, inner: string) => `\\{${inner}\\}`);
  return s.replace(/\u0001(\d+)\u0001/g, (_all, index: string) => holes[Number(index)] ?? "");
}

/**
 * Repair common JEE/PYQ bank LaTeX typos before KaTeX (NTA exam + review UI).
 * Fixes `\lim_\limits{…}`, `\text x`, glued `\rightarrow1+`, broken `\frac`, etc.
 */
const KNOWN_TEX_CMD =
  "mu|nu|lambda|pi|alpha|beta|gamma|theta|phi|psi|omega|sigma|rho|tau|delta|epsilon|sin|cos|tan|ln|log|lim|frac|sqrt|in|le|ge|neq|cdot|times|text|mathbf|mathrm|mathbb";

function collapseDoubledTexCommands(s: string): string {
  return s.replace(new RegExp(String.raw`\\\\(${KNOWN_TEX_CMD})\b`, "g"), "\\$1");
}

/** KaTeX ignores ordinary spaces, so `=1 4x` paints as `=14x`. */
function splitGluedLinearEquations(s: string): string {
  let t = s;
  t = t.replace(/(=\s*-?\d+)\s+(?=(?:\d+[A-Za-z]|[xyz]|\\[A-Za-z]))/g, "$1,\\quad ");
  t = t.replace(/(=\s*\\[A-Za-z]+)\s+(?=\\[A-Za-z]+,)/g, "$1,\\quad ");
  return t;
}

export function repairBankMathLatex(math: string): string {
  let s = normalizeBankMathEscapes(String(math ?? ""));
  s = s.replace(/\\u([0-9a-fA-F]{4})/g, (_m, hex: string) =>
    String.fromCharCode(Number.parseInt(hex, 16))
  );
  s = s.replace(/\r?\n\s*/g, " ");
  s = s.replace(/\\begin\{([a-z]+)\}\\n/g, "\\begin{$1} ");
  s = s.replace(/\\n(?!(?:eq|u|abla|ot|less|geq|int)\b)(?=[A-Za-z])/g, " ");
  s = collapseDoubledTexCommands(s);
  s = splitGluedLinearEquations(s);
  s = s.replace(/\u000crac/g, "\\frac");
  s = s.replace(/\u0008inom/g, "\\binom");
  s = s.replace(/\\ight\b/g, "\\right");
  s = s.replace(/\\hat\s+([ijk])\}/g, "\\hat{$1}");
  s = s.replace(/_{2,}/g, (run) => `\\_{}`.repeat(run.length));
  s = s.replace(/\\\\(begin|end)\{/g, "\\$1{");
  s = s.replace(/\}\s+\^{/g, "} {}^{");
  s = closeBareSetBraces(s);
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
  s = s.replace(/\u221a/g, "\\sqrt");
  s = s.replace(/\u2219/g, "\\cdot ");
  s = s.replace(/\u00D7/g, "\\times ");
  s = s.replace(/\u00B7/g, "\\cdot ");
  s = s.replace(/\s{2,}/g, " ");
  s = protectTexBrackets(s.trim());
  while (unescapedBraceDepth(s) < 0 && s.endsWith("}")) {
    s = s.slice(0, -1);
  }
  const depth = unescapedBraceDepth(s);
  if (depth > 0 && depth <= 3 && /\\(?:sqrt|frac|lim|sum|int|binom|text)(?![A-Za-z])/.test(s)) {
    s += "}".repeat(depth);
  }
  return s;
}

/** Keep GIF `[x]` / intervals `[a,b]` from being eaten or wrapped mid-bracket. */
export function protectTexBrackets(tex: string): string {
  const holes: string[] = [];
  const stash = (chunk: string) => {
    holes.push(chunk);
    return `\u0000${holes.length - 1}\u0000`;
  };
  let s = String(tex ?? "");
  s = s.replace(/\\sqrt\s*\[[^\]]*\]/g, stash);
  s = s.replace(/\\(?:left|right|bigl|bigr|Bigl|Bigr|big|Big)\s*\[/g, stash);
  s = s.replace(/\\lbrack\b/g, stash);
  s = s.replace(/(?<!\\)\[([^\]]*)\]/g, (_all, inner: string) => {
    if (inner.includes("&") || /\\\\/.test(inner)) return `[${inner}]`;
    if (inner.includes(",")) return `\\left[${inner}\\right]`;
    return `\\lbrack{${inner}}\\rbrack{}`;
  });
  return s.replace(/\u0000(\d+)\u0000/g, (_all, index: string) => holes[Number(index)] ?? "");
}

/** Safe fragment: one paragraph KaTeX can scan for `\(` / `\[` / `$$`. */
export function wrapPlainMockTextForKatexHtml(plain: string): string {
  const raw = String(plain ?? "").trim();
  if (!raw) return "";
  const t = normalizeBankMathEscapes(decodeBankPlainEntities(raw));
  return `<p class="nta-math-plain">${escapeHtmlTextNode(t)}</p>`;
}
