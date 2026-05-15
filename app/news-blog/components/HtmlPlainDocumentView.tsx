import type { HtmlPlainSource } from "../types";
import { articleJsonLd, htmlToSeoSafeDocument } from "../html-feed-and-seo";
import { formatDdMonYyyy } from "../key-date-time";

export function HtmlPlainDocumentView({
  source,
  variant,
  showSeoCallout = true,
  showHeader = true,
}: {
  source: HtmlPlainSource;
  variant: "article" | "card";
  /** When false, hides the small SEO helper label above the headline (e.g. public reader mode). */
  showSeoCallout?: boolean;
  /** When false, only the article body is shown (headline/summary live outside, e.g. public article page). */
  showHeader?: boolean;
}) {
  const rawHtml = source.rawHtml.trim();
  const plainBody = source.body.trim();
  const headline = source.title.trim();
  const summary = source.summary.trim();
  const bodyFromHtml = rawHtml ? htmlToSeoSafeDocument(rawHtml) : "";

  if (!plainBody && !rawHtml && !headline && !summary) return null;

  const bodyBlock =
    plainBody ? (
      <div
        className={
          variant === "card"
            ? "news-blog-seo-body news-blog-seo-body--card text-sm leading-relaxed text-slate-300 whitespace-pre-wrap"
            : "news-blog-seo-body text-base leading-relaxed text-slate-200 whitespace-pre-wrap"
        }
      >
        {plainBody}
      </div>
    ) : bodyFromHtml ? (
      <div
        className={
          variant === "card"
            ? "news-blog-seo-body news-blog-seo-body--card text-sm leading-relaxed text-slate-300"
            : "news-blog-seo-body text-base leading-relaxed text-slate-200"
        }
        dangerouslySetInnerHTML={{ __html: bodyFromHtml }}
      />
    ) : null;

  if (variant === "card") {
    return (
      <div className="mt-0 space-y-3 rounded-xl border border-slate-700/45 bg-[#0c1520]/90 p-4 sm:p-5">
        {showSeoCallout ? (
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Plain text (SEO preview)
          </p>
        ) : null}
        {headline ? (
          <h3 className="text-base font-semibold leading-snug text-slate-100">{headline}</h3>
        ) : null}
        {summary ? <p className="text-sm leading-relaxed text-slate-300">{summary}</p> : null}
        {bodyBlock}
      </div>
    );
  }

  const publishedIso = source.publishDate || source.createdAt || "";

  if (!showHeader) {
    if (!bodyBlock) return null;
    return (
      <div className="rounded-xl border border-slate-700/45 bg-[#0c1520]/90 p-5 sm:p-6">
        {bodyBlock}
      </div>
    );
  }

  return (
    <article className="space-y-6 rounded-xl border border-slate-700/45 bg-[#0c1520]/90 p-6 sm:p-8">
      <header className="space-y-3">
        {showSeoCallout ? (
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Plain text (SEO view)
          </p>
        ) : null}
        <h1 className="text-3xl font-semibold leading-tight tracking-tight text-slate-50 sm:text-[2.1rem]">
          {headline}
        </h1>
        {summary ? (
          <p className="text-lg leading-relaxed text-slate-300">{summary}</p>
        ) : null}
        {showSeoCallout && (source.author || publishedIso) ? (
          <p className="text-xs text-slate-500">
            {source.author ? <span>By {source.author}</span> : null}
            {source.author && publishedIso ? <span> · </span> : null}
            {publishedIso ? (
              <time dateTime={publishedIso}>
                {formatDdMonYyyy(publishedIso)}
              </time>
            ) : null}
          </p>
        ) : null}
      </header>
      {bodyBlock}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: articleJsonLd({
            headline,
            summary,
            author: source.author || "",
            publishDate: source.publishDate || "",
            createdAt: source.createdAt || "",
            image: source.heroImageUrl || "",
          }),
        }}
      />
    </article>
  );
}
