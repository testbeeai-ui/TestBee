"use client";

import React from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

/** Render LaTeX math with KaTeX. Returns null if parsing fails. */
function renderMath(latex: string, displayMode: boolean): string | null {
  try {
    return katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      output: "html",
      strict: false,
    });
  } catch {
    return null;
  }
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
            className="block my-3 p-4 rounded-lg bg-primary/5 border border-primary/20 overflow-x-auto"
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
            className="inline align-baseline [&>.katex]:text-[1em]"
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
        <strong key={key++} className="font-semibold text-foreground bg-primary/10 px-1 py-0.5 rounded">
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

/** Render theory content with proper heading hierarchy and readable formatting. Same pattern for Basic and Intermediate. */
export default function TheoryContent({ theory, className }: { theory: string; className?: string }) {
  const blocks = theory.split(/\n\n+/).filter((b) => b.trim());
  return (
    <div className={`space-y-6 text-[15px] leading-relaxed ${className ?? ""}`}>
      {blocks.map((block, i) => {
        const trimmed = block.trim();
        const singleLine = !trimmed.includes("\n");

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
