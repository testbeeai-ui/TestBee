"use client";

import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

type DoubtMarkdownProps = {
  content: string;
  className?: string;
  /** Smaller headings/spacing for dense panels (e.g. admin side sheets). */
  compact?: boolean;
};

/**
 * Renders doubt / answer text as Markdown with KaTeX (inline `$…$`, display `$$…$$`).
 * Ask / edit flows run {@link normalizePastedMathForDoubt} so pasted LaTeX delimiters and fenced code become `$` / `$$`.
 * KaTeX CSS is loaded globally from `app/layout.tsx`.
 */
export default function DoubtMarkdown({
  content,
  className = "",
  compact = false,
}: DoubtMarkdownProps) {
  const src = content?.trim() ?? "";
  if (!src) return null;

  const h12 = compact ? "text-xs font-bold mt-1 mb-0.5 first:mt-0" : "text-base font-bold mt-2 mb-1 first:mt-0";
  const h3Cls = compact
    ? "text-[11px] font-bold mt-1 mb-0 first:mt-0 leading-snug"
    : "text-sm font-bold mt-2 mb-0.5 first:mt-0";
  const h4Cls = compact
    ? "text-[11px] font-bold mt-0.5 mb-0 first:mt-0 leading-snug"
    : "text-sm font-bold mt-1.5 mb-0.5 first:mt-0";
  const hrCls = compact ? "my-2 border-border/80" : "my-3 border-border/80";
  const linkCls = compact
    ? "text-primary text-[11px] font-semibold underline underline-offset-2 hover:text-primary/90"
    : "text-primary font-semibold underline underline-offset-2 hover:text-primary/90";

  return (
    <div className={`doubt-markdown${compact ? " doubt-markdown-compact" : ""} ${className}`.trim()}>
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
                className={linkCls}
                {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              >
                {children}
              </a>
            );
          },
          img: () => null,
          h1: ({ children }) => <p className={h12}>{children}</p>,
          h2: ({ children }) => <p className={h12}>{children}</p>,
          h3: ({ children }) => <p className={h3Cls}>{children}</p>,
          h4: ({ children }) => <p className={h4Cls}>{children}</p>,
          p: ({ children }) =>
            compact ? (
              <p className="my-1 text-[11px] leading-snug first:mt-0 last:mb-0">{children}</p>
            ) : (
              <p>{children}</p>
            ),
          ul: ({ children }) =>
            compact ? (
              <ul className="my-1 list-disc space-y-0.5 pl-4 text-[11px] leading-snug">{children}</ul>
            ) : (
              <ul>{children}</ul>
            ),
          ol: ({ children }) =>
            compact ? (
              <ol className="my-1 list-decimal space-y-0.5 pl-4 text-[11px] leading-snug">{children}</ol>
            ) : (
              <ol>{children}</ol>
            ),
          li: ({ children }) =>
            compact ? <li className="leading-snug">{children}</li> : <li>{children}</li>,
          hr: () => <hr className={hrCls} />,
        }}
      >
        {src}
      </ReactMarkdown>
    </div>
  );
}
