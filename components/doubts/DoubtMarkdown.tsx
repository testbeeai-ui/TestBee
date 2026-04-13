"use client";

import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

type DoubtMarkdownProps = {
  content: string;
  className?: string;
};

/**
 * Renders doubt / answer text as Markdown with KaTeX (inline `$…$`, display `$$…$$`, `\(...\)`, `\[...\]`).
 * KaTeX CSS is loaded globally from `app/layout.tsx`.
 */
export default function DoubtMarkdown({ content, className = "" }: DoubtMarkdownProps) {
  const src = content?.trim() ?? "";
  if (!src) return null;

  return (
    <div className={`doubt-markdown ${className}`.trim()}>
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
          h1: ({ children }) => <p className="text-base font-bold mt-2 mb-1 first:mt-0">{children}</p>,
          h2: ({ children }) => <p className="text-base font-bold mt-2 mb-1 first:mt-0">{children}</p>,
          h3: ({ children }) => <p className="text-sm font-bold mt-2 mb-0.5 first:mt-0">{children}</p>,
          h4: ({ children }) => <p className="text-sm font-bold mt-1.5 mb-0.5 first:mt-0">{children}</p>,
          hr: () => <hr className="my-3 border-border/80" />,
        }}
      >
        {src}
      </ReactMarkdown>
    </div>
  );
}
