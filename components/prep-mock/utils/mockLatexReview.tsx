"use client";

import katex from "katex";
import { repairBankMathLatex } from "@/lib/mock/mockRichTextKatex";
import { cn } from "@/lib/utils";

function decodeMockEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&minus;/gi, "\u2212")
    .replace(/&times;/gi, "\u00D7")
    .replace(/&middot;/gi, "\u00B7")
    .replace(/&#92;/g, "\\")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .replace(/&[a-zA-Z0-9]+;/g, " ");
}

function renderMockLatexToHtml(raw: string): string {
  if (!raw.trim()) return "";

  let s = decodeMockEntities(raw.trim());
  s = s.replace(/\\{2,}([()[\]{}])/g, "\\$1");
  s = s.replace(/\\{2,}([A-Za-z])/g, "\\$1");

  const hasMathDelimiters =
    /\\\[[\s\S]+?\\\]/.test(s) ||
    /\\\([\s\S]+?\\\)/.test(s) ||
    /\$\$[\s\S]+?\$\$/.test(s) ||
    /\$[^\n$]+?\$/.test(s);

  const looksLikeLatexBlock =
    !hasMathDelimiters &&
    (/[\\][A-Za-z]+/.test(s) || /\\frac\s*\{/.test(s) || /\\sum\b|\\int\b|\\lim\b/.test(s));

  const repairLatex = (inner: string) =>
    repairBankMathLatex(inner)
      .replace(/\\(theta|alpha|beta|gamma|delta|lambda|mu|pi|rho|sigma|phi|omega)\b/g, "\\$1")
      .replace(/\\\(/g, "")
      .replace(/\\\)/g, "")
      .replace(/\\\[/g, "")
      .replace(/\\\]/g, "")
      .replace(/\\{2,}(?=[A-Za-z])/g, "\\");

  if (looksLikeLatexBlock) {
    const repaired = repairLatex(s);
    try {
      const html = katex.renderToString(repaired, {
        displayMode: true,
        throwOnError: false,
        output: "html",
        strict: false,
      });
      if (!html.includes("katex-error")) {
        return `<span class="block overflow-x-auto my-1 text-center">${html}</span>`;
      }
    } catch {
      // fall through
    }
  }

  const result: string[] = [];
  const pattern = /(\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$\$[\s\S]+?\$\$|\$[^\n$]+?\$)/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(s)) !== null) {
    if (match.index > last) {
      const txt = s.slice(last, match.index);
      result.push(
        txt
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\n/g, "<br>")
      );
    }

    const full = match[0];
    const isDisplay = full.startsWith("\\[") || full.startsWith("$$");
    const inner = full
      .replace(/^\\\(/, "")
      .replace(/\\\)$/, "")
      .replace(/^\\\[/, "")
      .replace(/\\\]$/, "")
      .replace(/^\$\$/, "")
      .replace(/\$\$$/, "")
      .replace(/^\$/, "")
      .replace(/\$$/, "")
      .trim();

    try {
      const firstPass = katex.renderToString(inner, {
        displayMode: isDisplay,
        throwOnError: false,
        output: "html",
        strict: false,
      });

      if (!firstPass.includes("katex-error")) {
        result.push(
          isDisplay
            ? `<span class="block overflow-x-auto my-1 text-center">${firstPass}</span>`
            : firstPass
        );
      } else {
        const repaired = repairLatex(inner);
        const secondPass = katex.renderToString(repaired, {
          displayMode: isDisplay,
          throwOnError: false,
          output: "html",
          strict: false,
        });

        if (!secondPass.includes("katex-error")) {
          result.push(
            isDisplay
              ? `<span class="block overflow-x-auto my-1 text-center">${secondPass}</span>`
              : secondPass
          );
        } else {
          result.push(full.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"));
        }
      }
    } catch {
      result.push(full.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"));
    }

    last = match.index + full.length;
  }

  if (last < s.length) {
    result.push(
      s
        .slice(last)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br>")
    );
  }

  return result.join("");
}

export function ReviewInlineHtml({ text, block = false }: { text: string; block?: boolean }) {
  const rawTrimmed = text.trim();
  if (!rawTrimmed) return null;

  let src = rawTrimmed;
  if (src.includes("<") && /<[a-zA-Z][\s\S]*?>/.test(src)) {
    src = src
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<[^>]+>/g, " ");
  }

  const html = renderMockLatexToHtml(src);

  return (
    <span
      className={cn(
        "[&_.katex]:text-[0.97em] [&_.katex-display]:my-1",
        block ? "block leading-relaxed" : "inline align-middle"
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export function formatMockExamTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
