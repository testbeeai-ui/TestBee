"use client";

import React from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

function enhanceVectorLatex(latex: string): string {
  let out = latex;
  // Raise only hat accents (i, j, k, x, y, z, etc.) without affecting vector arrows.
  out = out.replace(/\\hat\{([^}]+)\}/g, "\\widehat{$1}");
  return out;
}

function normalizeKatexRetryLatex(latex: string): string {
  let out = latex;
  out = out.replace(/\\{2,}(?=[()[\]{}A-Za-z])/g, "\\");
  out = out.replace(/\\widehat\{\$\s*\\?([A-Za-z0-9]+)\s*\$\}/g, "\\widehat{$1}");
  out = out.replace(
    /\\widehat\{([A-Za-z0-9]+)\}\{\$?\s*([A-Za-z0-9]+)\s*\$?\}/g,
    "\\widehat{$1}^{$2}",
  );
  out = out.replace(/\\widehat\{([A-Za-z0-9]+)\}\{\$?\s*th(?:'s)?\s*\$?\}/gi, "\\widehat{$1}^{\\text{th}}");
  out = out.replace(/\\widehat\{([^}]+)\}\s*\{([^}]+)\}/g, "\\widehat{$1}^{$2}");
  out = out.replace(/\\widehat\{([^}]+)\}\s*([A-Za-z0-9+\-]+)/g, "\\widehat{$1}^{$2}");
  out = out.replace(/\\\(|\\\)|\\\[|\\\]/g, "");
  return out;
}

function renderMath(latex: string, displayMode: boolean): string | null {
  try {
    const fixed = repairCorruptedLatexEscapes(latex);
    const firstPass = katex.renderToString(enhanceVectorLatex(fixed), {
      displayMode,
      throwOnError: false,
      output: "html",
      strict: false,
    });
    if (!firstPass.includes("katex-error")) return firstPass;

    const retry = normalizeKatexRetryLatex(fixed);
    const secondPass = katex.renderToString(enhanceVectorLatex(retry), {
      displayMode,
      throwOnError: false,
      output: "html",
      strict: false,
    });
    // Never surface red KaTeX error spans to users.
    if (secondPass.includes("katex-error")) return null;
    return secondPass;
  } catch {
    return null;
  }
}

/**
 * Repair LaTeX broken when stored in JSON (or similar): `\f` in `\frac` becomes
 * form feed U+000C; `\t` in `\times` becomes tab; `\n` in `\neq`/`\nabla` becomes newline.
 * Some pipelines also mangle `\frac` into a literal ♠ + "rac" (U+2660).
 */
function repairCorruptedLatexEscapes(s: string): string {
  let out = s;
  // Remove hidden control chars that often appear as red replacement glyphs in UI.
  // Keep \n and \t for text layout; drop the rest.
  out = out.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "");
  // Bad generator typo: \uparrowrac{…}{…} instead of \frac{…}{…} (Curie–Weiss, etc.)
  out = out.replace(/\\uparrowrac\b/g, "\\frac");
  // Broader arrow-variant typos seen in some payloads: ↑rac, ⬆rac, \uarrac, \arrowrac.
  out = out.replace(/(?:\\uarrac|\\arrowrac)\b/g, "\\frac");
  out = out.replace(/(?:\\(?:up)?arrow|[↑⇑⬆⭡⇧↟])\s*rac\b/g, "\\frac");
  // Last-resort recovery for malformed "\frac" prefixes such as "\xrac", "\yrac", "^rac", "rac".
  // Scope is limited to command-like tokens immediately before a brace to avoid normal prose changes.
  out = out.replace(/\\[A-Za-z^]*rac(?=\s*\{)/g, "\\frac");
  out = out.replace(/(^|[=\s(])(?:\^|[↑⇑⬆⭡⇧↟])?\s*rac(?=\s*\{)/g, "$1\\frac");
  // JSON "\frac{...}" → \f + "rac{...}" (form feed)
  out = out.replace(/\u000cfrac\b/g, "\\frac");
  out = out.replace(/\u000cbox\b/g, "\\fbox");
  out = out.replace(/\u000cos\b/g, "\\cos");
  out = out.replace(/\u000can\b/g, "\\tan");
  out = out.replace(/\u000cec\b/g, "\\sec");
  out = out.replace(/\u000csc\b/g, "\\csc");
  // Literal spade + "rac" (reported on Coulomb worked-example content)
  out = out.replace(/\u2660rac\b/g, "\\frac");
  out = out.replace(/♠rac\b/g, "\\frac");
  // JSON "\times" → tab + "imes"
  out = out.replace(/\u0009imes\b/g, "\\times");
  // JSON "\neq", "\nabla", "\theta", "\tan", "\text{…}"
  out = out.replace(/\u000aeq\b/g, "\\neq");
  out = out.replace(/\u000Ababla\b/g, "\\nabla");
  out = out.replace(/\u0009heta\b/g, "\\theta");
  out = out.replace(/\u0009an\b/g, "\\tan");
  out = out.replace(/\u0009ext(?=\s*\{)/g, "\\text");
  // Common payload artifact: math commands arrive over-escaped (\\widehat, \\\\sum, ...).
  // Collapse repeated slashes before delimiters/commands to a single LaTeX slash.
  out = out.replace(/\\{2,}(?=[()[\]{}A-Za-z])/g, "\\");
  // JSON "\mathrm{…}", "\rho" — \r is carriage return (U+000D)
  out = out.replace(/\u000Dm\{/g, "\\mathrm{");
  out = out.replace(/\u000Dho\b/g, "\\rho");
  out = out.replace(/\u000Dightarrow\b/g, "\\rightarrow");
  // Common trig command corruption from model output.
  out = out.replace(/\\os(?=\s|[\^_{(]|$)/g, "\\cos");
  out = out.replace(/\\an(?=\s|[\^_{(]|$)/g, "\\tan");
  out = out.replace(/\\ec(?=\s|[\^_{(]|$)/g, "\\sec");
  out = out.replace(/\\sc(?=\s|[\^_{(]|$)/g, "\\csc");
  // Sometimes the leading "\" is dropped inside math snippets (e.g. "os x").
  // Missing-slash trig words should be fixed only in math-like contexts, not prose.
  out = out.replace(/\bos(?=\s*(?:x\b|\(|\^|_))/gi, "\\cos");
  out = out.replace(/\ban(?=\s*(?:x\b|\(|\^|_))/gi, "\\tan");
  out = out.replace(/\bec(?=\s*(?:x\b|\(|\^|_))/gi, "\\sec");
  out = out.replace(/\bsc(?=\s*(?:x\b|\(|\^|_))/gi, "\\csc");
  // Complex-number artifacts:
  // 1) \widehat{i}{n}      -> \widehat{i}^{n}
  // 2) $\widehat{i}${4k}   -> $\widehat{i}^{4k}$
  // 3) \widehat{i}k        -> \widehat{i}^{k}
  out = out.replace(/\\widehat\{([^}]+)\}\s*\{([^}]+)\}/g, "\\widehat{$1}^{$2}");
  out = out.replace(/\$\s*\\widehat\{([^}]+)\}\s*\$\s*\{([^}]+)\}/g, "$\\widehat{$1}^{$2}$");
  out = out.replace(/\\widehat\{([^}]+)\}\s*([A-Za-z0-9]+)/g, "\\widehat{$1}^{$2}");
  // Combinatorics notation often arrives as "^nC_r" which KaTeX treats as invalid (missing base).
  // Normalize to "{}^{n}C_{r}" so expressions render instead of turning red.
  out = out.replace(
    /(^|[\s(=+\-},;])\^\{?\s*([A-Za-z0-9]+)\s*\}?\s*C\s*_\s*\{?\s*([A-Za-z0-9]+)\s*\}?/g,
    "$1{}^{$2}C_{$3}",
  );
  return out;
}

/**
 * Fix glued units in electrostatics "Solution: We know:" lines, e.g.
 * `10^{-7} Cq_2` → `10^{-7} C, q_2`, `C Cr =` → `C, r =`, `0.3 mk =` → `0.3 m, k =`.
 */
function repairRunonPhysicsGivenLine(s: string): string {
  let out = s;
  out = out.replace(/\}\s*Cq_/g, "} C, q_");
  out = out.replace(/\}\s*Cr\s*=/g, "} C, r =");
  out = out.replace(/(\d(?:\.\d+)?)\s*m\s*k\s*=/g, "$1 m, k =");
  return out;
}

/**
 * Normalizes legacy AI content stored in DB so it renders correctly:
 * - Converts HTML <br> tags to newlines
 * - Converts \( ... \) and \[ ... \] into $...$ / $$...$$
 * - Cleans excessive blank lines
 */
function normalizeTheoryForRender(raw: string): string {
  let out = repairCorruptedLatexEscapes(String(raw ?? ""));

  // Legacy line breaks from model output.
  out = out.replace(/<br\s*\/?>/gi, "\n");
  // HTML entities pasted into LaTeX break KaTeX (& starts tab alignment; × must be \times).
  out = out.replace(/&times;/gi, "\\times ");
  out = out.replace(/&middot;/gi, "\\cdot ");
  out = out.replace(/&sdot;/gi, "\\cdot ");
  out = out.replace(/&div;/gi, "\\div ");
  out = out.replace(/&minus;/gi, "-");
  out = out.replace(/&nbsp;/g, " ");
  out = out.replace(/×/g, "\\times ");
  // Normalize over-escaped delimiters like "\\(" / "\\\\[" to "\(" / "\[".
  out = out.replace(/\\{2,}(?=[()[\]])/g, "\\");

  // Convert bracketed LaTeX to dollar syntax used by this renderer.
  out = out.replace(/\\\[((?:.|\n)*?)\\\]/g, (_, expr: string) => `$$${expr.trim()}$$`);
  out = out.replace(/\\\(((?:.|\n)*?)\\\)/g, (_, expr: string) => `$${expr.trim()}$`);
  // Normalize malformed markdown headings like "##Heading" -> "## Heading".
  out = out.replace(/(^|\n)(#{1,6})([^ #\n])/g, "$1$2 $3");

  // Topic-hub headings are sometimes returned with paragraph text on the same line.
  // Force a clean heading line so it renders like a title, then body below it.
  const structuredHeadings = [
    "Core concept overview",
    "Key terminology",
    "Formula framework and meaning",
    "Reaction pattern and mechanism framework",
    "Problem-solving/process framework",
    "Exam pattern and question types",
    "Common mistakes and traps",
    "How to approach solving questions",
    "Quick revision checklist",
  ];
  for (const heading of structuredHeadings) {
    const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(
      new RegExp(`(^|\\n)(#{2,3}\\s*${escaped})(\\s+)(?=\\S)`, "gi"),
      "$1$2\n"
    );
  }

  // Ensure there is a blank line after markdown heading lines so block splitting
  // keeps headings separate from the following paragraph.
  out = out.replace(/(^|\n)(#{1,4}\s+[^\n]+)\n(?!\n)/g, "$1$2\n\n");

  // Presentation polish: split inline "Example"/"Maximum Work" callouts onto their own lines
  // so dense physics prose reads as clear point + separate example.
  // Handles forms like:
  //   " - Example: ...", " - **Example 1:** ...", ". **Maximum Work:** ..."
  out = out.replace(
    /\s+[-–—]\s*\*{0,2}(Example(?:\s*\d+)?|Maximum Work|Minimum Work)\*{0,2}\s*:\s*/gi,
    "\n\n**$1:** "
  );
  out = out.replace(
    /([.?!])\s+\*{0,2}(Example(?:\s*\d+)?|Maximum Work|Minimum Work)\*{0,2}\s*:\s*/gi,
    "$1\n\n**$2:** "
  );

  // Normalize common math shorthand issues from model output:
  // - i^, j^, k^  ->  \hat{i}, \hat{j}, \hat{k}
  // - unicode unit vectors (î, ĵ, k̂) -> hat notation
  // - combining vector arrow (a⃗) -> \vec{a}
  out = out.replace(
    /\b([ijk])[\s\u200B-\u200D\uFEFF]*[\^ˆ](?!\d)/gi,
    (_m, v: string) => `$\\hat{${v.toLowerCase()}}$`
  );
  out = out.replace(/î/g, "$\\hat{i}$");
  out = out.replace(/ĵ/g, "$\\hat{j}$");
  out = out.replace(/k\u0302/g, "$\\hat{k}$");
  out = out.replace(/([A-Za-z])\u20d7/g, (_m, v: string) => `$\\vec{${v}}$`);

  // Merge fragmented vector terms like "x $\\hat{i}$" into "$x\\hat{i}$".
  out = out.replace(
    /([A-Za-z0-9_\\{}]+)\s*\$\\hat\{([ijk])\}\$/g,
    (_m, coeff: string, basis: string) => `$${coeff}\\hat{${basis}}$`
  );

  // Merge fragmented inline math around operators/variables:
  // "$\\vec{r}$ = x $\\hat{i}$ + y $\\hat{j}$" -> "$\\vec{r} = x\\hat{i} + y\\hat{j}$"
  out = mergeFragmentedInlineMath(out);

  // Ampère's circuital law (line-integral form): models sometimes emit a quoted "." instead of \cdot
  // between \\vec{B} and d\\vec{l}, or a bare period that KaTeX stacks oddly.
  out = out.replace(
    /\\vec\{B\}\s*[`\u201C\u201D\u2018\u2019"']\s*\.\s*[`\u201C\u201D\u2018\u2019"']\s*d\\vec\{l\}/gi,
    "\\vec{B} \\cdot d\\vec{l}",
  );
  out = out.replace(
    /\\vec\{B\}\s*\.\s*d\\vec\{l\}(\s*=\s*\\mu)/gi,
    "\\vec{B} \\cdot d\\vec{l}$1",
  );
  // Subscript "enclosed" in mu_0 I_enclosed → proper \\text inside display math
  out = out.replace(/(\\mu_0\s*)I_\{?enclosed\}?/gi, "$1I_{\\text{enclosed}}");

  out = repairRunonPhysicsGivenLine(out);

  // Plain "Question:" / "Solution:" (no **) still renders bold in some exports — normalize so label parsing runs.
  out = out.replace(/(^|\n)(Question|Solution):\s+/gm, "$1**$2:** ");

  // Trim trailing spaces and collapse excessive blank lines.
  out = out
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return out;
}

function isInlineMathChunk(chunk: string): boolean {
  return /^\$(?!\$)[\s\S]*\$(?!\$)$/.test(chunk);
}

function stripInlineMathDelimiters(chunk: string): string {
  return chunk.replace(/^\$(?!\$)/, "").replace(/\$(?!\$)$/, "");
}

function isMergeableMathSeparator(separator: string): boolean {
  if (!separator) return true;
  // Only merge across pure math-operator/whitespace separators.
  // Allowed: whitespace, =, +, -, −, (, ), /, single digits, single letters (variables).
  // Forbidden: colons, semicolons, periods, commas, exclamation, question marks,
  // asterisks (markdown bold), pipes, ampersands — these are sentence structure.
  if (/[:.;,!?*|&]/.test(separator)) return false;
  const allowed = /^[\s=+\-−/<>()_{}\[\]0-9\\\p{L}λ]*$/u.test(separator);
  if (!allowed) return false;
  return !/\p{L}{2,}/u.test(separator);
}

function mergeFragmentedInlineMath(text: string): string {
  const inlineMathToken = /(\$(?!\$)[^$\n]+?\$(?!\$))/g;
  let parts = text.split(inlineMathToken);
  let changed = true;
  let guard = 0;

  while (changed && guard < 12) {
    changed = false;
    guard++;

    for (let i = 1; i < parts.length - 2; i += 2) {
      const leftMath = parts[i] ?? "";
      const separator = parts[i + 1] ?? "";
      const rightMath = parts[i + 2] ?? "";
      if (!isInlineMathChunk(leftMath) || !isInlineMathChunk(rightMath)) continue;
      if (!isMergeableMathSeparator(separator)) continue;

      const leftInner = stripInlineMathDelimiters(leftMath);
      const rightInner = stripInlineMathDelimiters(rightMath);
      parts[i] = "";
      parts[i + 1] = "";
      parts[i + 2] = `$${leftInner}${separator}${rightInner}$`;
      changed = true;
    }

    if (changed) {
      parts = parts.join("").split(inlineMathToken);
    }
  }

  return parts.join("");
}

/** Render inline bold **x**, italic *x*, and LaTeX $x$ / $$x$$ within text. */
function renderInlineFormatting(text: string) {
  const parts: (string | React.ReactElement)[] = [];
  let remaining = text.replace(/\\\\(?=[()[\]])/g, "\\");
  let key = 0;
  while (remaining.length > 0) {
    // Display math $$...$$ (allow leading whitespace — e.g. "**label:** $$ ... $$")
    const displayMathMatch = remaining.match(/^\s*\$\$([\s\S]*?)\$\$/);
    if (displayMathMatch) {
      const html = renderMath(displayMathMatch[1].trim(), true);
      if (html) {
        parts.push(
          <span
            key={key++}
            className="theory-display-math block my-2 py-3.5 px-4 rounded-xl text-center bg-sky-50/90 dark:bg-sky-950/30 border border-sky-200/60 dark:border-sky-800/45 overflow-x-auto shadow-sm [&_.katex-display]:my-0 [&_.katex-display]:text-center [&_.katex]:text-[1.05em] sm:[&_.katex]:text-[1.08em]"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      } else {
        parts.push(displayMathMatch[0]);
      }
      remaining = remaining.slice(displayMathMatch[0].length);
      continue;
    }
    // Display math \[...\]
    const bracketDisplayMatch = remaining.match(/^\s*\\\[([\s\S]*?)\\\]/);
    if (bracketDisplayMatch) {
      const html = renderMath(bracketDisplayMatch[1].trim(), true);
      if (html) {
        parts.push(
          <span
            key={key++}
            className="theory-display-math block my-2 py-3.5 px-4 rounded-xl text-center bg-sky-50/90 dark:bg-sky-950/30 border border-sky-200/60 dark:border-sky-800/45 overflow-x-auto shadow-sm [&_.katex-display]:my-0 [&_.katex-display]:text-center [&_.katex]:text-[1.05em] sm:[&_.katex]:text-[1.08em]"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      } else {
        parts.push(bracketDisplayMatch[0]);
      }
      remaining = remaining.slice(bracketDisplayMatch[0].length);
      continue;
    }
    // Inline math $...$ (not $$); allow leading whitespace
    const inlineMathMatch = remaining.match(/^\s*\$([^$\n]+)\$/);
    if (inlineMathMatch) {
      const html = renderMath(inlineMathMatch[1].trim(), false);
      if (html) {
        parts.push(
          <span
            key={key++}
            className="theory-inline-math inline align-baseline [&>.katex]:text-[1em]"
            style={{ background: "transparent", padding: 0, borderRadius: 0, boxShadow: "none" }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      } else {
        parts.push(inlineMathMatch[0]);
      }
      remaining = remaining.slice(inlineMathMatch[0].length);
      continue;
    }
    // Inline math \(...\)
    const parenInlineMathMatch = remaining.match(/^\\\(([\s\S]*?)\\\)/);
    if (parenInlineMathMatch) {
      const html = renderMath(parenInlineMathMatch[1].trim(), false);
      if (html) {
        parts.push(
          <span
            key={key++}
            className="theory-inline-math inline align-baseline [&>.katex]:text-[1em]"
            style={{ background: "transparent", padding: 0, borderRadius: 0, boxShadow: "none" }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      } else {
        parts.push(parenInlineMathMatch[0]);
      }
      remaining = remaining.slice(parenInlineMathMatch[0].length);
      continue;
    }
    const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/);
    const italicMatch = remaining.match(/^\*([^*]+)\*/);
    if (boldMatch) {
      parts.push(
        <strong key={key++} className="font-semibold text-foreground">
          {renderInlineFormatting(boldMatch[1])}
        </strong>
      );
      remaining = remaining.slice(boldMatch[0].length);
    } else if (italicMatch) {
      parts.push(
        <em key={key++} className="italic text-foreground/90">
          {renderInlineFormatting(italicMatch[1])}
        </em>
      );
      remaining = remaining.slice(italicMatch[0].length);
    } else {
      const nextDollar = remaining.indexOf("$");
      const nextParenMath = remaining.indexOf("\\(");
      const nextBracketMath = remaining.indexOf("\\[");
      const nextBold = remaining.indexOf("**");
      const nextItalic = remaining.indexOf("*");
      let next = remaining.length;
      if (nextDollar >= 0 && nextDollar < next) next = nextDollar;
      if (nextParenMath >= 0 && nextParenMath < next) next = nextParenMath;
      if (nextBracketMath >= 0 && nextBracketMath < next) next = nextBracketMath;
      if (nextBold >= 0 && nextBold < next) next = nextBold;
      if (nextItalic >= 0 && nextItalic < next) next = nextItalic;
      const chunk = next > 0 ? remaining.slice(0, next) : remaining[0] ?? "";
      if (chunk) parts.push(chunk);
      remaining = remaining.slice(next || 1);
    }
  }
  return parts;
}

type TrapListItem = { num: string; body: string };

/** When the model continues a point with another `N. …` line, the dense splitter treats `2. Second…` as a new item (capital S). Merge those into one row. */
function mergeConsecutiveDuplicateNumbers(items: TrapListItem[]): TrapListItem[] {
  const out: TrapListItem[] = [];
  for (const item of items) {
    const prev = out[out.length - 1];
    if (prev && prev.num === item.num) {
      prev.body = `${prev.body} ${item.body}`.replace(/\s+/g, " ").trim();
    } else {
      out.push({ num: item.num, body: item.body });
    }
  }
  return out;
}

/**
 * Detects "Trap 1 / Trap 2" style sections (Common Traps, etc.) from AI markdown.
 * Supports: **- Trap N:** … (dense or split), and line-based "- Trap N:".
 */
function parseTrapsStructured(trimmed: string): { intro: string; items: TrapListItem[] } | null {
  const boldTrap = /\*\*-\s*Trap\s+\d+:/;
  if (boldTrap.test(trimmed)) {
    const segments = trimmed
      .split(/(?=\*\*-\s*Trap\s+\d+:)/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (segments.length === 0) return null;
    const firstIdx = segments.findIndex((s) => boldTrap.test(s));
    if (firstIdx < 0) return null;
    const intro = firstIdx > 0 ? segments.slice(0, firstIdx).join("\n\n").trim() : "";
    const items: TrapListItem[] = [];
    for (let k = firstIdx; k < segments.length; k++) {
      const m = segments[k].match(/^\*\*-\s*Trap\s+(\d+):\s*([\s\S]*)$/);
      if (m) items.push({ num: m[1], body: m[2].trim() });
    }
    return items.length > 0 ? { intro, items } : null;
  }

  // Dense single line: "- Trap 1: … - Trap 2: …" (no line breaks)
  if (!trimmed.includes("\n")) {
    const dashTrapMatches = trimmed.match(/-\s*Trap\s+\d+:/gi);
    if (dashTrapMatches && dashTrapMatches.length >= 2) {
      const parts = trimmed
        .split(/(?=\s-\s*Trap\s+\d+:)/i)
        .map((s) => s.trim())
        .filter(Boolean);
      const trapLineReOne = /^-\s*Trap\s+(\d+):\s*(.*)$/i;
      const items: TrapListItem[] = [];
      for (const p of parts) {
        const m = p.match(trapLineReOne);
        if (m) items.push({ num: m[1], body: m[2].trim() });
      }
      if (items.length > 0) return { intro: "", items };
    }
  }

  const lines = trimmed.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const trapLineRe = /^-\s*Trap\s+(\d+):\s*(.*)$/i;
  const trapIndices = lines
    .map((l, idx) => (trapLineRe.test(l) ? idx : -1))
    .filter((idx) => idx >= 0);
  if (trapIndices.length === 0) return null;

  if (trapIndices.length === lines.length) {
    return {
      intro: "",
      items: lines.map((l) => {
        const m = l.match(trapLineRe)!;
        return { num: m[1], body: m[2].trim() };
      }),
    };
  }

  if (trapIndices.length >= 1) {
    const firstTrap = trapIndices[0];
    const intro = firstTrap > 0 ? lines.slice(0, firstTrap).join("\n").trim() : "";
    const items: TrapListItem[] = [];
    for (let t = 0; t < trapIndices.length; t++) {
      const lineIdx = trapIndices[t];
      const nextIdx = trapIndices[t + 1] ?? lines.length;
      const m = lines[lineIdx].match(trapLineRe)!;
      const tail = lines.slice(lineIdx + 1, nextIdx);
      const body = tail.length ? [m[2], ...tail].join("\n").trim() : m[2].trim();
      items.push({ num: m[1], body });
    }
    return { intro, items };
  }

  return null;
}

/** Split token for "2. Next item" after "1. First …" — avoids `2.5` and "Fig. 2." style false splits where possible. */
const DENSE_ORDERED_ITEM_START = /\d{1,2}\.\s+(?:\*\*|[A-ZÀ-Ÿ\$\\(])/u;

function parseDenseOrderedListItemsFromListPart(listPart: string): TrapListItem[] | null {
  const compact = listPart.replace(/\s+/g, " ").trim();
  if (!/^\d{1,2}\.\s+/.test(compact)) return null;

  const splitNextItem = new RegExp(`\\s+(?=${DENSE_ORDERED_ITEM_START.source})`, "u");
  if (!splitNextItem.test(compact)) return null;

  const parts = compact.split(splitNextItem).map((s) => s.trim()).filter(Boolean);
  if (parts.length < 2) return null;

  const items: TrapListItem[] = [];
  for (const p of parts) {
    const m = p.match(/^(\d{1,2})\.\s+([\s\S]*)$/);
    if (!m) return null;
    items.push({ num: m[1], body: m[2].trim() });
  }
  return mergeConsecutiveDuplicateNumbers(items);
}

/**
 * Run-on ordered lists (e.g. "Typical Mistakes"): `1. **A** … 2. **B** …`
 * Internal newlines are compacted to spaces so multi-line model output still parses.
 */
function parseDenseOrderedListParagraph(trimmed: string): { intro: string; items: TrapListItem[] } | null {
  const items = parseDenseOrderedListItemsFromListPart(trimmed);
  if (!items || items.length < 2) return null;
  return { intro: "", items };
}

/**
 * Same as dense list, but allows leading prose (exam strategy blocks):
 * `CBSE … To secure full marks: 1. Draw … 2. State … 3. Show …`
 */
function parseDenseOrderedListWithIntro(trimmed: string): { intro: string; items: TrapListItem[] } | null {
  const compact = trimmed.replace(/\s+/g, " ").trim();
  const itemHead = new RegExp(`(?<=^|[\\s:])(${DENSE_ORDERED_ITEM_START.source})`, "gu");
  const matches = [...compact.matchAll(itemHead)];
  if (matches.length < 2) return null;

  const listStart = matches[0].index ?? 0;
  const intro = compact.slice(0, listStart).trim();
  const listPart = compact.slice(listStart).trim();

  const mFirst = listPart.match(/^(\d{1,2})\./);
  if (!mFirst || mFirst[1] !== "1") return null;

  const items = parseDenseOrderedListItemsFromListPart(listPart);
  if (!items || items.length < 2) return null;
  return { intro, items };
}

/**
 * Example 2–style "comparative" physics (e.g. long solenoid B₁ vs B₂): step labels (*italic* or plain)
 * are glued in one paragraph ("Initial field: … New current: …"). Split before each label so
 * SolutionStepsBlock renders like Example 1’s numbered list.
 */
function splitComparativePhysicsSolutionSteps(rest: string): string[] | null {
  const t = rest.replace(/\s+/g, " ").trim();
  if (t.length < 24) return null;

  const hasInitialField = /(?:\*Initial field:\*|\bInitial field:)/i.test(t);
  const hasComparativeSteps =
    /(?:\*New turn density:\*|\bNew turn density:)/i.test(t) ||
    /(?:\*New current:\*|\bNew current:)/i.test(t) ||
    /(?:\*New field:\*|\bNew field:)/i.test(t);
  if (!hasInitialField || !hasComparativeSteps) return null;

  // Split before each step label. Allow optional space after ":" (plain export) and "Result:*" typos.
  const stepBoundary =
    /\s+(?=\*Initial field:\*|\*New turn density:\*|\*New current:\*|\*New field:\*|\*Result:\*|\bInitial field:\s*|\bNew turn density:\s*|\bNew current:\s*|\bNew field:\s*|\bResult:\s*\*|\bResult:\s)/gi;

  const parts = t
    .split(stepBoundary)
    .map((s) => s.trim())
    .filter(Boolean);

  const cleaned = parts.map((p) =>
    p.replace(/^Result:\*\s+/i, "*Result:* ")
  );

  return cleaned.length >= 2 ? cleaned : null;
}

/**
 * Worked examples often store the whole solution as one paragraph ("Volume…. Taking logs…. Given…").
 * Split on sentence boundaries before typical step-start words so each step renders on its own row.
 */
function splitWorkedExampleSolutionSteps(rest: string): string[] {
  const comparative = splitComparativePhysicsSolutionSteps(rest);
  if (comparative) return comparative;

  const t = rest.trim();
  if (t.length < 40) return [t];

  const lines = t.split(/\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length >= 2) return lines;

  // After ". " (or ".** " etc.), next token starts a new reasoning step.
  const stepStart =
    "(?:Taking|Substitute|Substituting|Given|Therefore|Hence|Thus|Now|Next|Also|Finally|Alternatively|Using|Apply|Here|From\\s+the|We\\s+have|We\\s+get|This\\s+gives|Simplifying|Calculating|Resolving|So\\s+the|New|Resistance|Volume|Current|Power|Imply|It\\s+follows)";
  // Physics lines like "4%. dR/R = …" (lowercase differential quotient after a full stop).
  const derivQuotient = "d[A-Za-z]{1,6}/[A-Za-z]";

  const re = new RegExp(`\\.\\s+(?=(?:${stepStart}\\b|${derivQuotient}))`, "gi");
  const chunks: string[] = [];
  let start = 0;
  const r = new RegExp(re.source, re.flags);
  let m: RegExpExecArray | null;
  while ((m = r.exec(t)) !== null) {
    const afterDot = m.index + 1;
    const segment = t.slice(start, afterDot).trim();
    if (segment) chunks.push(segment);
    start = m.index + m[0].length;
  }
  const tail = t.slice(start).trim();
  if (tail) chunks.push(tail);

  return chunks.length >= 2 ? chunks : [t];
}

/**
 * Worked solutions often use "1. Find …: … 2. Find …: …" on one line.
 * Split so each numbered step becomes its own SolutionStepsBlock row.
 */
function splitSolutionNumberedSubsteps(rest: string): string[] | null {
  const t = rest.trim();
  if (t.length < 20) return null;
  // Step starts: space + "N. " + (optional **) + letter (avoids "6.92" style decimals)
  const stepHead = /\s+(?=[1-9]\d?\.\s+(?:\*\*)?[A-Za-z])/g;
  const parts = t.split(stepHead).map((s) => s.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  if (!/^\d{1,2}\.\s+/.test(parts[0]!)) return null;
  return parts;
}

function splitSolutionRestIntoSteps(rest: string): string[] {
  const numbered = splitSolutionNumberedSubsteps(rest);
  if (numbered) return numbered;
  const worked = splitWorkedExampleSolutionSteps(rest);
  return worked.length ? worked : [rest.trim()];
}

/** `## Title\\n**Question:**` in one chunk (single newlines) — split heading from body so heading isn't a wall of text. */
function splitHeadingRestBlock(trimmed: string): string[] {
  const m = trimmed.match(/^(#{1,4}\s+[^\n]+)\n([\s\S]+)$/);
  if (!m?.[2]) return [trimmed];
  const body = m[2].trim();
  if (!body) return [trimmed];
  return [m[1].trim(), body];
}

/** One \\n\\n block sometimes contains both **Question:** and **Solution:** — split so each gets its own renderer. */
function splitBlockOnQuestionSolutionLabels(trimmed: string): string[] {
  const re = /(\*\*(?:Question|Solution)\*\*:\s*|\*(?:Question|Solution)\*:\s*)/gi;
  const matches = [...trimmed.matchAll(re)];
  if (matches.length === 0) return [trimmed];

  const parts: string[] = [];
  const firstIdx = matches[0]!.index ?? 0;
  if (firstIdx > 0) {
    const head = trimmed.slice(0, firstIdx).trim();
    if (head) parts.push(head);
  }
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i]!.index ?? 0;
    const end = matches[i + 1]?.index ?? trimmed.length;
    parts.push(trimmed.slice(start, end).trim());
  }
  return parts.length ? parts : [trimmed];
}

function expandTheoryBlocks(blocks: string[]): string[] {
  const out: string[] = [];
  for (const block of blocks) {
    const t = block.trim();
    const headBody = splitHeadingRestBlock(t);
    const segments = headBody.length === 2 ? headBody : [t];
    for (const seg of segments) {
      const sub = splitBlockOnQuestionSolutionLabels(seg.trim());
      out.push(...(sub.length > 1 ? sub : [seg.trim()]));
    }
  }
  return out;
}

/** AI output often glues rows as `...| Solenoid | | :--- |` — insert newlines before the next row. */
function normalizeRunonPipeTableString(s: string): string {
  let out = s;
  out = out.replace(/\|\s+\|\s+(?=:[-:]{2,})/g, "|\n| ");
  out = out.replace(/\|\s+\|\s+(?=\*\*)/g, "|\n| ");
  // Next row starts with Title Case phrase then ` | ` (e.g. "| … | | Form continuous … |")
  out = out.replace(
    /\|\s+\|\s+(?=[A-Z][a-z]{2,}(?:\s+[a-z,°\-²³]+)*\s*\|)/g,
    "|\n| "
  );
  return out;
}

function splitPipeTableRow(line: string): string[] {
  const t = line.trim();
  if (!t.startsWith("|")) return [];
  const core = t.endsWith("|") ? t.slice(1, -1) : t.slice(1);
  return core.split("|").map((c) => c.trim());
}

function isMarkdownTableSeparatorRow(line: string): boolean {
  const cells = splitPipeTableRow(line);
  return (
    cells.length >= 2 &&
    cells.every((c) => {
      const x = c.trim();
      return /^:?-{2,}:?$/.test(x);
    })
  );
}

function cellAlignFromSeparator(cell: string): "left" | "center" | "right" {
  const t = cell.trim();
  if (/^:[-:]+:$/.test(t)) return "center";
  if (/^[-:]+:$/.test(t)) return "right";
  return "left";
}

function tryParseMarkdownPipeTable(raw: string): {
  header: string[];
  aligns: ("left" | "center" | "right")[];
  rows: string[][];
} | null {
  const normalized = normalizeRunonPipeTableString(raw.trim());
  const linesAll = normalized.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const lines = linesAll.filter((l) => l.startsWith("|") && l.includes("|", 1));
  if (lines.length < 2) return null;

  const sepIdx = lines.findIndex(isMarkdownTableSeparatorRow);
  if (sepIdx < 1) return null;

  const header = splitPipeTableRow(lines[0]);
  if (header.length < 2) return null;

  const sepCells = splitPipeTableRow(lines[sepIdx]);
  const aligns: ("left" | "center" | "right")[] = [];
  for (let j = 0; j < header.length; j++) {
    aligns.push(cellAlignFromSeparator(sepCells[j] ?? "---"));
  }

  const rows: string[][] = [];
  for (let r = sepIdx + 1; r < lines.length; r++) {
    if (isMarkdownTableSeparatorRow(lines[r])) continue;
    const row = splitPipeTableRow(lines[r]);
    if (row.length === 0) continue;
    const padded = [...row];
    while (padded.length < header.length) padded.push("");
    rows.push(padded.slice(0, header.length));
  }
  if (rows.length === 0) return null;
  return { header, aligns, rows };
}

function trySplitBlockTablePreamble(trimmed: string): {
  preamble: string;
  header: string[];
  aligns: ("left" | "center" | "right")[];
  rows: string[][];
} | null {
  const lines = trimmed.split(/\n/);
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (!l.startsWith("|")) continue;
    const pipeCount = (l.match(/\|/g) ?? []).length;
    if (pipeCount >= 3) {
      start = i;
      break;
    }
  }
  if (start < 0) return null;
  const tableSpan = lines.slice(start).join("\n");
  const parsed = tryParseMarkdownPipeTable(tableSpan);
  if (!parsed) return null;
  const preamble = lines
    .slice(0, start)
    .join("\n")
    .trim();
  return { preamble, ...parsed };
}

const tableAlignClass: Record<"left" | "center" | "right", string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

function MarkdownTableBlock({
  header,
  aligns,
  rows,
}: {
  header: string[];
  aligns: ("left" | "center" | "right")[];
  rows: string[][];
}) {
  return (
    <div className="overflow-x-auto my-4 rounded-xl border border-border bg-muted/30 shadow-sm">
      <table className="w-full min-w-[300px] text-sm border-collapse">
        <thead>
          <tr className="border-b-2 border-primary/35 bg-primary/8">
            {header.map((h, j) => (
              <th
                key={j}
                scope="col"
                className={`px-3 py-2.5 font-semibold text-foreground ${tableAlignClass[aligns[j] ?? "left"]}`}
              >
                {renderInlineFormatting(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-b border-border/70 last:border-b-0 odd:bg-background/50">
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className={`px-3 py-2.5 text-muted-foreground align-top ${tableAlignClass[aligns[ci] ?? "left"]}`}
                >
                  {renderInlineFormatting(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SolutionStepsBlock({ labelHtml, steps }: { labelHtml: string; steps: string[] }) {
  const splitStepLines = (step: string): string[] => {
    const compact = step.replace(/\s+/g, " ").trim();
    if (!compact) return [];
    let out = compact;
    // Strip leading "N. Title:" from the body (step number is already in the left column).
    out = out.replace(/^\d{1,2}\.\s+[^:]+:\s*/i, "").trim();
    // Common physics / numeric derivation phrases — each on its own line.
    out = out.replace(
      /\s+(?=(?:The\s+load|Area|Pressure|Force|Diameter|Volume|Current|Using|By\s+Pascal|Hence|Thus|Therefore)\b)/gi,
      "\n"
    );
    out = out.replace(
      /([.!?])\s+(?=(?:Area|Pressure|Force|The\s+load|Diameter|By\s+Pascal|Hence|Thus|Therefore)\b)/gi,
      "$1\n"
    );
    // Break before assignments like F_2 =, A_1 =, P =, d_1 = (subscripts allowed).
    out = out.replace(/\s+(?=[A-Za-z][A-Za-z0-9_]{0,12}\s*=\s)/g, "\n");
    return out
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
  };

  return (
    <div className="space-y-3 pl-4 py-2.5 rounded-r-lg bg-primary/5 border-l-[3px] border-primary/60">
      <span className="inline-block text-sm font-semibold text-primary [&_.katex]:text-[1em]">
        {renderInlineFormatting(labelHtml)}
      </span>
      <ol className="space-y-3 list-none pl-0 m-0" role="list">
        {steps.map((step, j) => (
          <li
            key={j}
            className="flex gap-3 text-muted-foreground pl-0 border-l-0"
            role="listitem"
          >
            <span className="font-semibold text-foreground/80 shrink-0 tabular-nums w-6 text-right select-none">
              {j + 1}.
            </span>
            <div className="min-w-0 flex-1 leading-relaxed space-y-1.5">
              {splitStepLines(step).map((line, k) => (
                <div key={k}>{renderInlineFormatting(line)}</div>
              ))}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function TrapListBlock({ intro, items }: { intro: string; items: TrapListItem[] }) {
  return (
    <div className="space-y-4 my-3">
      {intro ? (
        <p className="text-muted-foreground">{renderInlineFormatting(intro)}</p>
      ) : null}
      <ol className="space-y-4 list-none pl-0" role="list">
        {items.map((item, j) => (
          <li
            key={j}
            className="flex gap-2.5 text-muted-foreground pl-4 py-1 border-l-2 border-primary/20"
            role="listitem"
          >
            <span className="font-bold text-foreground shrink-0 tabular-nums min-w-[1.75rem]">{item.num}.</span>
            <span className="min-w-0 flex-1">{renderInlineFormatting(item.body)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Render theory content with proper heading hierarchy and readable formatting. Same pattern for Basic and Intermediate. */
export default function TheoryContent({ theory, className }: { theory: string; className?: string }) {
  const normalizedTheory = normalizeTheoryForRender(theory);
  const blocks = expandTheoryBlocks(normalizedTheory.split(/\n\n+/).filter((b) => b.trim()));
  return (
    <div
      className={`theory-content-readable font-sans space-y-6 text-[15px] leading-relaxed min-w-0 max-w-full [overflow-wrap:anywhere] break-words ${className ?? ""}`}
    >
      {blocks.map((block, i) => {
        const trimmed = block.trim();
        const singleLine = !trimmed.includes("\n");

        // Standard markdown headings: #, ##, ###, ####
        const mdHeading = trimmed.match(/^(#{1,4})\s+(.+)$/);
        if (singleLine && mdHeading) {
          const level = mdHeading[1].length;
          const text = mdHeading[2].trim();
          const cls =
            level === 1
              ? "text-2xl font-extrabold text-foreground mt-3 mb-1 pb-2 border-b-2 border-primary/30 first:mt-0 [&_.katex]:text-[1em]"
              : level === 2
                ? "text-xl font-extrabold text-foreground mt-6 mb-1.5 pb-1 border-b border-border first:mt-0 tracking-tight [&_.katex]:text-[1em]"
                : level === 3
                  ? "text-lg font-extrabold text-foreground mt-5 mb-1.5 first:mt-0 tracking-tight [&_.katex]:text-[1em]"
                  : "text-base font-bold text-foreground mt-4 mb-1 first:mt-0 [&_.katex]:text-[1em]";
          if (level === 1) return <h1 key={i} className={cls}>{renderInlineFormatting(text)}</h1>;
          if (level === 2) return <h2 key={i} className={cls}>{renderInlineFormatting(text)}</h2>;
          if (level === 3) return <h3 key={i} className={cls}>{renderInlineFormatting(text)}</h3>;
          return <h4 key={i} className={cls}>{renderInlineFormatting(text)}</h4>;
        }

        // Topic title: **🏛️ Topic 1: ...** or **Topic 1: ... (Basic/Intermediate Level)**
        if (singleLine && /^\*\*.*Topic \d+:/.test(trimmed)) {
          const text = trimmed.replace(/^\*\*|\*\*$/g, "");
          return (
            <h2
              key={i}
              className="text-xl font-bold text-foreground mt-2 mb-1 pb-2 border-b-2 border-primary/30 first:mt-0 first:border-t-0 [&_.katex]:text-[1em]"
            >
              {renderInlineFormatting(text)}
            </h2>
          );
        }

        // Main topic heading: **The Main Topic: ...**
        if (singleLine && /^\*\*The Main Topic:/.test(trimmed)) {
          const text = trimmed.replace(/^\*\*|\*\*$/g, "");
          return (
            <h3
              key={i}
              className="text-lg font-bold text-foreground mt-6 first:mt-0 pt-2 border-t border-border first:border-t-0 first:pt-0 [&_.katex]:text-[1em]"
            >
              {renderInlineFormatting(text)}
            </h3>
          );
        }

        // Section heading: **The Subtopics...**
        if (singleLine && /^\*\*The Subtopics/.test(trimmed)) {
          const text = trimmed.replace(/^\*\*|\*\*$/g, "");
          return (
            <h4 key={i} className="text-base font-bold text-foreground mt-6 [&_.katex]:text-[1em]">
              {renderInlineFormatting(text)}
            </h4>
          );
        }

        // Subtopic heading: **Subtopic N:** or **Subtopic N.N:** (e.g. 1.1, 1.2) — renders $U$, $Q$, $W$ etc. as math
        if (singleLine && /^\*\*Subtopic \d+(\.\d+)?:/.test(trimmed)) {
          const text = trimmed.replace(/^\*\*|\*\*$/g, "");
          return (
            <h4
              key={i}
              className="text-base font-bold text-foreground mt-6 pl-4 py-2.5 border-l-4 border-primary/50 bg-primary/5 rounded-r-lg [&_.katex]:text-[1em]"
            >
              {renderInlineFormatting(text)}
            </h4>
          );
        }

        // Markdown image: ![alt](url)
        const imgMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
        if (imgMatch) {
          const [, alt, src] = imgMatch;
          return (
            <figure key={i} className="my-6">
              <img
                src={src}
                alt={alt || ""}
                className="max-w-full h-auto rounded-xl border border-border shadow-md"
              />
              {alt && (
                <figcaption className="mt-2 text-sm text-muted-foreground italic text-center">{alt}</figcaption>
              )}
            </figure>
          );
        }

        const tableWithPreamble = trySplitBlockTablePreamble(trimmed);
        if (tableWithPreamble) {
          const { preamble, header, aligns, rows } = tableWithPreamble;
          return (
            <div key={i} className="space-y-4">
              {preamble ? (
                <div className="text-base font-semibold text-foreground [&_.katex]:text-[1em]">
                  {renderInlineFormatting(preamble)}
                </div>
              ) : null}
              <MarkdownTableBlock header={header} aligns={aligns} rows={rows} />
            </div>
          );
        }

        const trapsParsed = parseTrapsStructured(trimmed);
        if (trapsParsed && trapsParsed.items.length > 0) {
          return <TrapListBlock key={i} intro={trapsParsed.intro} items={trapsParsed.items} />;
        }

        const denseOrderedWithIntro = parseDenseOrderedListWithIntro(trimmed);
        if (denseOrderedWithIntro && denseOrderedWithIntro.items.length > 0) {
          return <TrapListBlock key={i} intro={denseOrderedWithIntro.intro} items={denseOrderedWithIntro.items} />;
        }

        const denseOrdered = parseDenseOrderedListParagraph(trimmed);
        if (denseOrdered && denseOrdered.items.length > 0) {
          return <TrapListBlock key={i} intro={denseOrdered.intro} items={denseOrdered.items} />;
        }

        // Bullet list block (all non-empty lines start with "* " or "- ")
        const lines = trimmed.split(/\n/).map((l) => l.trim()).filter(Boolean);
        const allBullets = lines.length > 0 && lines.every((l) => /^[\*\-]\s+/.test(l));
        if (allBullets) {
          return (
            <ul key={i} className="space-y-2 list-none pl-0 my-3">
              {lines.map((line, j) => {
                const content = line.replace(/^[\*\-]\s+/, "");
                return (
                  <li key={j} className="flex gap-2 text-muted-foreground pl-4 border-l-2 border-primary/20">
                    <span className="text-primary font-semibold shrink-0">•</span>
                    <span>{renderInlineFormatting(content)}</span>
                  </li>
                );
              })}
            </ul>
          );
        }

        // Ordered list block: every line starts with "1. ", "2. ", … (e.g. Key Properties & Edge Cases)
        const allNumbered = lines.length > 0 && lines.every((l) => /^\d+\.\s+/.test(l));
        if (allNumbered) {
          const numberedItems = lines.map((line, j) => {
            const m = line.match(/^(\d+)\.\s+(.*)$/);
            const num = m?.[1] ?? String(j + 1);
            const content = (m?.[2] ?? line.replace(/^\d+\.\s+/, "")).trim();
            return { num, body: content };
          });
          const mergedNumbered = mergeConsecutiveDuplicateNumbers(numberedItems);
          return (
            <ol key={i} className="space-y-4 list-none pl-0 my-3" role="list">
              {mergedNumbered.map((item, j) => (
                <li key={j} className="flex gap-2.5 text-muted-foreground pl-4 py-1 border-l-2 border-primary/20" role="listitem">
                  <span className="font-bold text-foreground shrink-0 tabular-nums min-w-[1.75rem]">
                    {item.num}.
                  </span>
                  <span className="min-w-0 flex-1">{renderInlineFormatting(item.body)}</span>
                </li>
              ))}
            </ol>
          );
        }

        // Label + content: *Italic Label:* or **Bold Label:**
        const italicLabelMatch = trimmed.match(/^\*([^*]+)\*:\s*/);
        const boldLabelMatch = trimmed.match(/^\*\*([^*]+)\*\*:\s*/);
        const labelMatch = italicLabelMatch || boldLabelMatch;
        if (labelMatch) {
          const label = labelMatch[1];
          const rest = trimmed.slice(labelMatch[0].length).trim();
          if (/^solution$/i.test(label.trim())) {
            const steps = splitSolutionRestIntoSteps(rest);
            return <SolutionStepsBlock key={i} labelHtml={`${label}:`} steps={steps} />;
          }
          return (
            <div key={i} className="space-y-1.5 pl-4 py-2.5 rounded-r-lg bg-primary/5 border-l-[3px] border-primary/60">
              <span className="inline-block text-sm font-semibold text-primary [&_.katex]:text-[1em]">
                {renderInlineFormatting(label + ":")}
              </span>
              <p className="text-muted-foreground pl-0 sm:pl-2">
                {renderInlineFormatting(rest)}
              </p>
            </div>
          );
        }

        // Single-line paragraph starting with "1. " / "2. " — bold the number (common under section headings)
        if (singleLine) {
          const numbered = trimmed.match(/^(\d+)\.\s+([\s\S]+)$/);
          if (numbered) {
            const [, num, rest] = numbered;
            return (
              <p key={i} className="text-muted-foreground">
                <span className="font-bold text-foreground">{num}. </span>
                {renderInlineFormatting(rest)}
              </p>
            );
          }
        }

        // Regular paragraph
        return (
          <p key={i} className="text-muted-foreground">
            {renderInlineFormatting(trimmed)}
          </p>
        );
      })}
    </div>
  );
}
