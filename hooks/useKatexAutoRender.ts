"use client";

import { useLayoutEffect, type RefObject } from "react";
import renderMathInElement from "katex/contrib/auto-render";
import { repairBankMathLatex } from "@/lib/mockRichTextKatex";

/** `$$` / `$` must come before `\(` so display `$$` wins; `ignoredClasses: ['katex']` avoids re-parsing KaTeX output on timer re-renders. */
const DELIMITERS = [
  { left: "$$", right: "$$", display: true as const },
  { left: "$", right: "$", display: false as const },
  { left: "\\(", right: "\\)", display: false as const },
  { left: "\\[", right: "\\]", display: true as const },
];

/** PYQ / bank HTML: repair malformed limit, text, and arrow markup before KaTeX parses. */
function preProcessBankMath(math: string): string {
  return repairBankMathLatex(math);
}

/**
 * Assign sanitized HTML imperatively, then KaTeX auto-render — **before** the browser paints.
 * Avoids `dangerouslySetInnerHTML` in React, which would SSR/hydrate raw `\\(` text for ~1 frame.
 *
 * `revision` is an optional extra dependency (e.g. question id) so the effect’s dependency array
 * stays a fixed length — React forbids changing the dependency list size between renders.
 */
export function useKatexAutoRender(
  containerRef: RefObject<HTMLElement | null>,
  safeHtml: string,
  revision?: unknown
) {
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.innerHTML = safeHtml;
    if (!safeHtml.trim()) return;
    try {
      // `preProcess` exists at runtime (KaTeX auto-render) but is missing from bundled typings.
      renderMathInElement(el, {
        delimiters: DELIMITERS,
        throwOnError: false,
        preProcess: preProcessBankMath,
        ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code", "option"],
        ignoredClasses: ["katex"],
      } as Parameters<typeof renderMathInElement>[1]);
    } catch {
      /* ignore */
    }
  }, [safeHtml, revision]);
}
