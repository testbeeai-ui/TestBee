"use client";

import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { normalizePastedMathForDoubt } from "@/lib/normalizePastedDoubtMath";
import { formatPlayQuestionStemForDisplay } from "@/lib/playQuestionMathDisplay";
import { cn } from "@/lib/utils";

export type PlayQuestionMarkdownVariant = "stem" | "option" | "explanation";

type PlayQuestionMarkdownProps = {
  source: string;
  className?: string;
  /** stem = question block; option = inside MCQ button (inline-ish); explanation = smaller prose */
  variant?: PlayQuestionMarkdownVariant;
};

/** Normalize bank strings for remark-math + KaTeX ($ / $$) and light markdown (**bold**). */
export function preprocessPlayQuestionMarkdown(raw: string): string {
  const trimmed = formatPlayQuestionStemForDisplay(String(raw ?? "").trim());
  if (!trimmed) return "";
  return normalizePastedMathForDoubt(trimmed);
}

/**
 * Markdown + KaTeX for adaptive / arena questions (physics, chemistry, math, …).
 * Same stack as doubts chat; use wherever {@link PlayQuestionCard} shows stems and options.
 */
export default function PlayQuestionMarkdown({
  source,
  className = "",
  variant = "stem",
}: PlayQuestionMarkdownProps) {
  const src = preprocessPlayQuestionMarkdown(source);
  if (!src) return null;

  const optionish = variant === "option";

  return (
    <div
      className={cn(
        "play-question-md min-w-0 max-w-full [overflow-wrap:anywhere] text-foreground",
        "[&_.katex]:text-[0.95em] [&_.katex-display]:my-1 [&_.katex-display]:max-w-full",
        optionish && "inline-block w-full min-w-0 align-middle [&_.katex-display]:block",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          a: ({ href, children }) => {
            const safe = href && !href.toLowerCase().startsWith("javascript:") ? href : "#";
            const external = /^https?:\/\//i.test(safe);
            return (
              <a
                href={safe}
                className="text-primary font-semibold underline underline-offset-2 hover:text-primary/90"
                {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              >
                {children}
              </a>
            );
          },
          img: () => null,
          h1: ({ children }) => <p className="m-0 text-[1em] font-bold leading-snug first:mt-0">{children}</p>,
          h2: ({ children }) => <p className="m-0 text-[1em] font-bold leading-snug first:mt-0">{children}</p>,
          h3: ({ children }) => <p className="m-0 text-[0.95em] font-bold leading-snug first:mt-0">{children}</p>,
          h4: ({ children }) => <p className="m-0 text-[0.95em] font-bold leading-snug first:mt-0">{children}</p>,
          hr: () => <hr className="my-2 border-border/60" />,
          p: ({ children }) =>
            optionish ? (
              <span className="m-0 inline leading-snug">{children}</span>
            ) : (
              <p className="m-0 leading-snug [&:not(:first-child)]:mt-1.5">{children}</p>
            ),
        }}
      >
        {src}
      </ReactMarkdown>
    </div>
  );
}
