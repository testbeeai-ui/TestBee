import type { GeneratedTeacherTest } from "@/lib/teacherPortal/generatedTest";
import katex from "katex";
import {
  fixGreekInsideTextBlocks,
  formatPlayQuestionStemForDisplay,
} from "@/lib/play/questions/playQuestionMathDisplay";
import { normalizePastedMathForDoubt } from "@/lib/normalizePastedDoubtMath";

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function cleanOptionHtml(text: string): string {
  if (!text) return "";
  // Strip any <p>, </p>, <strong>, </strong>, <b>, </b> from option text
  return text
    .replace(/<\/?p[^>]*>/gi, "")
    .replace(/<\/?strong[^>]*>/gi, "")
    .replace(/<\/?b\b[^>]*>/gi, "")
    .replace(/&nbsp;/gi, " ")
    .trim();
}

export function balanceHtmlTags(html: string): string {
  if (!html) return "";
  const tags = ["p", "strong", "b", "span", "div"];
  let balanced = html.trim();

  for (const tag of tags) {
    const openCount = (balanced.match(new RegExp(`<${tag}\\b[^>]*>`, "gi")) || []).length;
    const closeCount = (balanced.match(new RegExp(`<\/${tag}>`, "gi")) || []).length;
    if (openCount > closeCount) {
      const diff = openCount - closeCount;
      balanced += `</${tag}>`.repeat(diff);
    }
  }
  return balanced;
}

function toLatex(text: string): string {
  let s = text.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "");
  s = s.replace(/→|⇒|⟹/g, " \\rightarrow ");
  s = s.replace(/\s+->\s+/g, " \\rightarrow ");
  s = s.replace(/&times;/gi, " \\times ");
  s = s.replace(/&middot;/gi, " \\cdot ");
  s = s.replace(/&minus;/gi, "-");
  s = s.replace(/&nbsp;/g, " ");
  s = s.replace(/×/g, " \\times ");
  s = s.replace(/\\uparrowrac\b/g, "\\frac");
  s = s.replace(/(?:\\uarrac|\\arrowrac)\b/g, "\\frac");
  s = s.replace(/(?:\\(?:up)?arrow|[↑⇑⬆⭡⇧↟])\s*rac\b/g, "\\frac");
  s = s.replace(/\\[A-Za-z^]*rac(?=\s*\{)/g, "\\frac");
  s = s.replace(/(^|[=\s(])(?:\^|[↑⇑⬆⭡⇧↟])?\s*rac(?=\s*\{)/g, "$1\\frac");
  s = s.replace(/\\\{\s*\\pi\s*\}/g, "\\pi");
  s = s.replace(/\{\s*\\pi\s*\}/g, "\\pi");
  s = s.replace(/\\{2,}(?=[()[\]{}A-Za-z])/g, "\\");
  s = s.replace(/piepsilon_0/g, "\\pi\\varepsilon_0");
  s = s.replace(/piepsilon/g, "\\pi\\varepsilon");
  s = s.replace(/\blambda\b/g, "\\lambda");
  s = s.replace(/(\d)\s+x\s+(\d)/g, "$1 \\times $2");
  s = s.replace(/([A-Za-z])_1_2\b/g, "$1_{12}");
  s = s.replace(/\bintegral_\{([^}]+)\}\^\{([^}]+)\}/gi, "\\int_{$1}^{$2}");
  s = s.replace(/\bintegral_([a-zA-Z0-9]+)\^([a-zA-Z0-9]+)\b/g, "\\int_{$1}^{$2}");
  s = s.replace(/\bintegral_([a-zA-Z])\s*\^\s*([a-zA-Z])\b/g, "\\int_{$1}^{$2}");
  s = s.replace(/\bpi\s*r\b/gi, "\\pi r");
  s = s.replace(/\bpir\b/gi, "\\pi r");
  s = s.replace(/\\os(?=\s|[\^_{(]|$)/g, "\\cos");
  s = s.replace(/\\an(?=\s|[\^_{(]|$)/g, "\\tan");
  s = s.replace(/\\ec(?=\s|[\^_{(]|$)/g, "\\sec");
  s = s.replace(/\\sc(?=\s|[\^_{(]|$)/g, "\\csc");
  s = s.replace(/\bos(?=\s*(?:x\b|\(|\^|_))/gi, "\\cos");
  s = s.replace(/\ban(?=\s*(?:x\b|\(|\^|_))/gi, "\\tan");
  s = s.replace(/\bec(?=\s*(?:x\b|\(|\^|_))/gi, "\\sec");
  s = s.replace(/\bsc(?=\s*(?:x\b|\(|\^|_))/gi, "\\csc");
  s = s.replace(/\\widehat\{([^}]+)\}\s*\{([^}]+)\}/g, "\\widehat{$1}^{$2}");
  s = s.replace(/\$\s*\\widehat\{([^}]+)\}\s*\$\s*\{([^}]+)\}/g, "$\\widehat{$1}^{$2}$");
  s = s.replace(/\\widehat\{([^}]+)\}\s*([A-Za-z0-9]+)/g, "\\widehat{$1}^{$2}");
  s = s.replace(
    /(^|[\s(=+\-},;])\^\{?\s*([A-Za-z0-9]+)\s*\}?\s*C\s*_\s*\{?\s*([A-Za-z0-9]+)\s*\}?/g,
    "$1{}^{$2}C_{$3}"
  );
  s = s.replace(/\bgeq\b/gi, "\\geq");
  s = s.replace(/\bleq\b/gi, "\\leq");
  return s;
}

function hasMathNotation(text: string): boolean {
  return (
    /[_^\\]|\d+\s*x\s+\d|piepsilon|lambda|\$|\\\(|\\\[/.test(text) ||
    /\b[A-Za-z](?::[A-Za-z])+\s*=\s*\d+(?::\d+)+/.test(text) ||
    /→|⇒|⟹/.test(text) ||
    /[\u00B2\u00B3\u2070-\u209F\u03C0\u2205\u2286\u00D7]/.test(text)
  );
}

function splitGluedGreekLetters(text: string): string {
  // Split glued letters after Greek commands: "\muC" -> "\mu{}C"
  // Uses {} so no visible space. Applies even inside math delimiters.
  return text.replace(
    /\\(mu|lambda|tau|sigma|rho|theta|alpha|beta|gamma|delta|epsilon|varepsilon|omega|phi|varphi|psi|pi|chi|eta|iota|kappa|nu|xi|zeta|Delta|Gamma|Lambda|Omega|Phi|Pi|Psi|Sigma|Theta|Xi)([A-Za-z])/g,
    "\\$1{}$2"
  );
}

function preprocessNakedMath(text: string): string {
  let t = splitGluedGreekLetters(text);
  if (!t.trim()) return t;
  if (/\\\(|\\\[|\$\$?/.test(t)) return t;

  // Handle unicode mu character (μ) directly
  t = t.replace(/μ/g, "\\mu ");

  // Wrap LaTeX Greek commands in \(...\)
  t = t.replace(
    /\\(mu|lambda|tau|sigma|rho|theta|alpha|beta|gamma|delta|epsilon|varepsilon|omega|phi|varphi|psi|pi|chi|eta|iota|kappa|nu|xi|zeta|Delta|Gamma|Lambda|Omega|Phi|Pi|Psi|Sigma|Theta|Xi)/g,
    "\\($1\\)"
  );

  // Wrap Greek letter names without backslash (common in plain text)
  t = t.replace(
    /\b(tau|sigma|rho|theta|alpha|beta|gamma|delta|epsilon|omega|phi|psi|lambda|mu)\b/gi,
    "\\($1\\)"
  );

  // Fallback: if still has naked math patterns, wrap entire text
  const hasNaked =
    /\\[a-zA-Z]{2,}\b/.test(t) ||
    /\b[a-z]\^(\d+)\b/i.test(t) ||
    /\blim\b/i.test(t) ||
    /\bsin\b/i.test(t) ||
    /\bcos\b/i.test(t) ||
    /\btan\b/i.test(t);
  if (hasNaked) {
    t = `\\(${toLatex(t)}\\)`;
  }

  return t;
}

function renderKatex(latex: string, display: boolean): string {
  try {
    const html = katex.renderToString(latex, {
      displayMode: display,
      throwOnError: false,
      output: "html",
      strict: false,
    });
    return html.includes("katex-error") ? escapeHtml(latex) : html;
  } catch {
    return escapeHtml(latex);
  }
}

function isHtml(text: string): boolean {
  return /<[a-z][\s\S]*>/i.test(text);
}

function renderRichHtmlWithMath(html: string): string {
  if (!html) return "";

  // 1) Replace <span class="math-text">...</span> with KaTeX
  const s = html.replace(/<span\s+class=["']math-text["']>([\s\S]*?)<\/span>/g, (match, inner) => {
    const cleaned = inner
      .replace(/&nbsp;/gi, " ")
      .replace(/&times;/gi, " \\times ")
      .replace(/&middot;/gi, " \\cdot ")
      .replace(/&minus;/gi, "-")
      .trim();
    return renderKatex(cleaned, false);
  });

  // 2) Parse standard LaTeX delimiters if they exist in the HTML (but without escaping the surrounding HTML!)
  const pattern = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)/g;
  const out: string[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(s)) !== null) {
    if (m.index > last) {
      out.push(s.slice(last, m.index)); // Keep HTML raw, DO NOT ESCAPE!
    }
    const display = !!(m[1] !== undefined || m[3] !== undefined);
    const inner = (m[1] ?? m[2] ?? m[3] ?? m[4] ?? "").trim();
    out.push(renderKatex(inner, display));
    last = m.index + m[0].length;
  }
  if (last < s.length) {
    out.push(s.slice(last)); // Keep remaining HTML raw!
  }

  return out.join("");
}

function renderMathTextToHtml(raw: string): string {
  if (!raw) return "";

  if (isHtml(raw)) {
    return renderRichHtmlWithMath(raw);
  }

  // CRITICAL: fix \mu inside \text{} (text mode doesn't recognize it)
  // and split \muC -> \mu{}C so KaTeX doesn't error on glued commands
  let s = splitGluedGreekLetters(fixGreekInsideTextBlocks(String(raw).trim()));
  s = formatPlayQuestionStemForDisplay(s);
  s = normalizePastedMathForDoubt(s);
  s = splitGluedGreekLetters(fixGreekInsideTextBlocks(s));

  if (!/\\\(|\\\[|\$/.test(s) && hasMathNotation(s)) {
    s = preprocessNakedMath(s);
  }

  const pattern = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)/g;

  const out: string[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(s)) !== null) {
    if (m.index > last) out.push(escapeHtml(s.slice(last, m.index)));
    const display = !!(m[1] !== undefined || m[3] !== undefined);
    const inner = (m[1] ?? m[2] ?? m[3] ?? m[4] ?? "").trim();
    out.push(renderKatex(inner, display));
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push(escapeHtml(s.slice(last)));
  return out.join("");
}

function renderMathTextWithImages(rawHtml: string | null | undefined, rawPlain: string): string {
  const s = rawHtml && rawHtml.trim() ? rawHtml : rawPlain;
  const imgs: string[] = [];
  const withPlaceholders = s.replace(/<img[^>]+>/g, (match) => {
    imgs.push(match);
    return `___IMG_PLACEHOLDER_${imgs.length - 1}___`;
  });

  let rendered = renderMathTextToHtml(withPlaceholders);

  imgs.forEach((img, idx) => {
    rendered = rendered.replace(`___IMG_PLACEHOLDER_${idx}___`, img);
  });

  return rendered;
}

export async function openTeacherTestPrintPreview(test: GeneratedTeacherTest): Promise<void> {
  const win = window.open("", "_blank");
  if (!win) throw new Error("Popup blocked. Please allow popups to print the test.");

  // Build investor-style header from test fields
  const scope = (test.scopeDetails?.[0] ?? test.scopeLabel ?? "")
    .replace(/^CHAPTER:\s*/i, "")
    .replace(/^TOPIC:\s*/i, "");
  const rawTopic = test.scopeDetails?.[1] ?? "";
  // Extract just the number, e.g. "12.4" from "12.4 Limits of Trigonometric Functions"
  const topicNumMatch = rawTopic.match(/^(\d+(?:\.\d+)?)/);
  const topicNum = topicNumMatch ? topicNumMatch[1] : "";
  // Topic name for subtitle (e.g. "Limits of Trigonometric Functions")
  const topicName = rawTopic.replace(/^\d+(?:\.\d+)?\s*/, "").trim();

  const headerTitle =
    test.name && test.name.trim()
      ? escapeHtml(test.name.trim())
      : `${escapeHtml(test.subjectLabel)} CLASS ${test.classLevelNumeric}: ${escapeHtml(scope)}${topicNum ? ` (TOPIC ${topicNum})` : ""}`;
  const headerSubtitle = `Time: ${test.durationMinutes} min | Questions: ${test.pickedCount}`; // board hidden per design

  // If all options are short (<=30 chars, no long prose), use compact 2x2 grid
  function useCompactOptions(opts: string[]): boolean {
    return (
      opts.length === 4 && opts.every((o) => o.length <= 35 && !/\b\w{8,}\b.*\b\w{8,}\b/.test(o))
    );
  }

  const questionsHtml = test.questions
    .map((q, idx) => {
      const compact = useCompactOptions(q.options);
      const optsHtml = q.options
        .map((opt: string, i: number) => {
          const cleanedOpt = cleanOptionHtml(opt);
          return `<div class="opt"><span class="opt-key">${String.fromCharCode(65 + i)}.</span><span class="opt-text">${renderMathTextWithImages(null, cleanedOpt)}</span></div>`;
        })
        .join("");

      const balancedStemHtml = q.questionHtml ? balanceHtmlTags(q.questionHtml) : q.question;
      return `
        <div class="q-item">
          <div class="q-row">
            <div class="q-num">${idx + 1}.</div>
            <div class="q-stem">${renderMathTextWithImages(balancedStemHtml, q.question)}</div>
          </div>
          <div class="${compact ? "opts-compact" : "opts"}">${optsHtml}</div>
        </div>
      `;
    })
    .join("");

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(test.name)}</title>
    <link
      rel="stylesheet"
      href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css"
      crossorigin="anonymous"
    />
    <style>
      @page { size: A4; margin: 14mm 10mm 22mm 10mm; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      
      .watermark {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) rotate(-25deg);
        display: inline-flex;
        align-items: center;
        height: 72px;
        opacity: 0.095; /* Faint but properly there, keeps questions fully readable */
        z-index: -1000;
        pointer-events: none;
        user-select: none;
      }
      
      .watermark img {
        height: 72px;
        width: auto;
        max-width: none;
        display: block;
      }
      
      .watermark-text {
        position: absolute;
        left: 76px;
        color: #000;
        font-family: "Segoe UI", Arial, sans-serif;
        font-size: 50px;
        font-weight: 600;
        background: #fff;
        line-height: 1;
        letter-spacing: 0.3px;
      }
      
      .print-footer {
        position: fixed;
        bottom: 2mm;
        left: 0;
        right: 0;
        height: 6mm;
        border-top: 1px solid #ddd;
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 8.5pt;
        color: #555;
        background: transparent;
        z-index: 1000;
        counter-increment: page;
      }
      
      .print-footer .logo-container {
        position: relative;
        display: inline-flex;
        align-items: center;
        height: 22px;
      }
      
      .print-footer .logo-container img {
        height: 22px;
        width: auto;
        max-width: none;
        display: block;
      }
      
      .print-footer .logo-container .footer-logo-text {
        position: absolute;
        left: 23.2px;
        color: #000;
        font-family: "Segoe UI", Arial, sans-serif;
        font-size: 15.2px;
        font-weight: 600;
        background: #fff;
        line-height: 1;
        letter-spacing: 0.1px;
      }
      
      .print-footer .powered-text {
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
        font-size: 9pt;
        font-weight: 500;
        color: #666;
      }
      
      .print-footer .page-number::after {
        content: "Page " counter(page);
        font-weight: 500;
      }
      body {
        counter-reset: page;
        font-family: "Segoe UI", Arial, sans-serif;
        font-size: 11pt;
        line-height: 1.35;
        color: #000;
        background: #fff;
      }
      img {
        max-width: 100%;
        height: auto;
        max-height: 1.8in;
        display: block;
        margin: 4px 0;
        border-radius: 4px;
        object-fit: contain;
      }
      table {
        width: 100%;
        max-width: 100%;
        border-collapse: collapse;
        margin: 6px 0;
        font-size: 9.5pt;
        table-layout: auto;
        page-break-inside: avoid;
      }
      table .katex {
        font-size: 1.08em !important; /* Scaled up formulas slightly for high readability */
      }
      th, td {
        border: 1px solid #444;
        padding: 4px 7px; /* Increased padding slightly for standard visual breathing room */
        text-align: left;
        vertical-align: middle;
        word-break: break-word;
        line-height: 1.25;
      }
      th {
        background-color: #f2f2f2;
        font-weight: 700;
      }
      .wrap { width: 100%; }
      .paper-header {
        text-align: center;
        border-bottom: 2px solid #000;
        padding-bottom: 4px;
        margin-bottom: 6px;
      }
      .paper-title {
        font-size: 16pt;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin: 0;
      }
      .paper-sub {
        font-size: 10pt;
        margin-top: 2px;
      }
      .questions {
        column-count: 2;
        column-gap: 28px;
        column-fill: auto;
      }
      .q-item {
        break-inside: avoid-column;
        -webkit-column-break-inside: avoid;
        page-break-inside: avoid;
        margin-bottom: 5px;
        padding-bottom: 3px;
        border-bottom: 0.5px solid #ddd;
      }
      .q-row {
        display: flex;
        gap: 4px;
        align-items: baseline;
        width: 100%;
      }
      .q-num {
        font-weight: 700;
        font-size: 11pt;
        min-width: 20px; /* Reduced from 24px for more stem breathing room */
        flex-shrink: 0;
      }
      .q-stem {
        font-size: 10.5pt;
        flex: 1;
        min-width: 0; /* Prevent flex overflow for tables/images */
      }
      .opts {
        margin-top: 2px;
        padding-left: 22px;
        display: flex;
        flex-direction: column;
        gap: 0px;
      }
      .opts-compact {
        margin-top: 2px;
        padding-left: 22px;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1px 8px;
      }
      .opt {
        display: flex;
        gap: 3px;
        align-items: baseline;
      }
      .opt-key {
        font-weight: 700;
        font-size: 10pt;
        min-width: 18px;
        flex-shrink: 0;
      }
      .opt-text {
        font-size: 10pt;
        flex: 1;
      }
      .katex { font-size: 1.2em; }
      .katex-display { margin: 0.2em 0; }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    </style>
  </head>
  <body>
    <!-- Faint Watermark on every page -->
    <div class="watermark">
      <img src="${window.location.origin}/images/edublast-wordmark-nobg-on-light.png" alt="EduBlast Watermark" />
      <span class="watermark-text">edublast</span>
    </div>
 
    <!-- Repeating Footer on every page -->
    <footer class="print-footer">
      <div class="logo-container">
        <img src="${window.location.origin}/images/edublast-wordmark-nobg-on-light.png" alt="EduBlast Logo" />
        <span class="footer-logo-text">edublast</span>
      </div>
      <div class="powered-text">Powered by Edublast.</div>
      <div class="page-number"></div>
    </footer>

    <div class="wrap">
      <header class="paper-header">
        <h1 class="paper-title">${headerTitle}</h1>
        <div class="paper-sub">${headerSubtitle}</div>
      </header>
      <div class="questions">${questionsHtml}</div>
    </div>
  </body>
</html>`;

  win.document.open("text/html", "replace");
  win.document.write(html);
  win.document.close();

  await new Promise<void>((resolve) => {
    const done = () => resolve();
    win.addEventListener(
      "load",
      () => {
        if (win.document.fonts) {
          win.document.fonts.ready.then(done).catch(done);
          setTimeout(done, 2000);
        } else {
          setTimeout(done, 1000);
        }
      },
      { once: true }
    );
    setTimeout(done, 4000);
  });
  win.focus();
  win.print();
}
