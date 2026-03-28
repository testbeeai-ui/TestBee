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

function renderMath(latex: string, displayMode: boolean): string | null {
  try {
    const fixed = repairCorruptedLatexEscapes(latex);
    return katex.renderToString(enhanceVectorLatex(fixed), {
      displayMode,
      throwOnError: false,
      output: "html",
      strict: false,
    });
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
  // JSON "\frac{...}" → \f + "rac{...}" (form feed)
  out = out.replace(/\u000cfrac\b/g, "\\frac");
  out = out.replace(/\u000cbox\b/g, "\\fbox");
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
  // JSON "\mathrm{…}", "\rho" — \r is carriage return (U+000D)
  out = out.replace(/\u000Dm\{/g, "\\mathrm{");
  out = out.replace(/\u000Dho\b/g, "\\rho");
  out = out.replace(/\u000Dightarrow\b/g, "\\rightarrow");
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

  out = repairRunonPhysicsGivenLine(out);

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
  let remaining = text;
  let key = 0;
  while (remaining.length > 0) {
    // Display math $$...$$
    const displayMathMatch = remaining.match(/^\$\$([\s\S]*?)\$\$/);
    if (displayMathMatch) {
      const html = renderMath(displayMathMatch[1].trim(), true);
      if (html) {
        parts.push(
          <span
            key={key++}
            className="theory-display-math block my-3 p-4 rounded-lg bg-primary/5 border border-primary/20 overflow-x-auto"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      } else {
        parts.push(displayMathMatch[0]);
      }
      remaining = remaining.slice(displayMathMatch[0].length);
      continue;
    }
    // Inline math $...$
    const inlineMathMatch = remaining.match(/^\$([^$]+)\$/);
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
      const nextBold = remaining.indexOf("**");
      const nextItalic = remaining.indexOf("*");
      let next = remaining.length;
      if (nextDollar >= 0 && nextDollar < next) next = nextDollar;
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
  const blocks = normalizedTheory.split(/\n\n+/).filter((b) => b.trim());
  return (
    <div className={`theory-content-readable font-sans space-y-6 text-[15px] leading-relaxed ${className ?? ""}`}>
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
