import type { GeneratedTeacherTest } from "@/lib/teacherPortal/generatedTest";
import katex from "katex";
import {
  fixGreekInsideTextBlocks,
  formatPlayQuestionStemForDisplay,
} from "@/lib/playQuestionMathDisplay";
import { normalizePastedMathForDoubt } from "@/lib/normalizePastedDoubtMath";

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

function renderMathTextToHtml(raw: string): string {
  if (!raw) return "";

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

  const headerTitle = `${escapeHtml(test.subjectLabel)} CLASS ${test.classLevelNumeric}: ${escapeHtml(scope)}${topicNum ? ` (TOPIC ${topicNum})` : ""}`;
  const headerSubtitle = `Time: ${test.durationMinutes} min | Questions: ${test.pickedCount} | ${escapeHtml(test.board)}${topicName ? ` - ${escapeHtml(topicName)}` : ""}`;

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
        .map(
          (opt: string, i: number) =>
            `<div class="opt"><span class="opt-key">${String.fromCharCode(65 + i)}.</span><span class="opt-text">${renderMathTextToHtml(opt)}</span></div>`
        )
        .join("");

      return `
        <div class="q-item">
          <div class="q-row">
            <span class="q-num">${idx + 1}.</span>
            <span class="q-stem">${renderMathTextToHtml(q.question)}</span>
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
      @page { size: A4; margin: 8mm 10mm; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        font-family: "Segoe UI", Arial, sans-serif;
        font-size: 13pt;
        line-height: 1.35;
        color: #000;
        background: #fff;
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
        column-gap: 20px;
        column-fill: balance;
      }
      .q-item {
        break-inside: avoid;
        page-break-inside: avoid;
        margin-bottom: 6px;
        padding-bottom: 4px;
        border-bottom: 0.5px solid #ddd;
      }
      .q-row {
        display: flex;
        gap: 4px;
        align-items: baseline;
      }
      .q-num {
        font-weight: 700;
        font-size: 13pt;
        min-width: 24px;
        flex-shrink: 0;
      }
      .q-stem {
        font-size: 12.5pt;
        flex: 1;
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
        font-size: 12pt;
        min-width: 18px;
        flex-shrink: 0;
      }
      .opt-text {
        font-size: 12pt;
        flex: 1;
      }
      .katex { font-size: 1.3em; }
      .katex-display { margin: 0.2em 0; }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    </style>
  </head>
  <body>
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
