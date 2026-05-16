import {
  bodyBlocksForTextView,
  buildKeywordList,
  buildToc,
  countWords,
  formatIndianDate,
  hostnameOf,
  isoDate,
  readingTime,
  shouldRenderToc,
  type Block,
  type SeoPost,
} from "../article-segment";
import { textFieldsSummary } from "../html-feed-and-seo";

interface Props {
  post: SeoPost;
  showHero?: boolean;
  isAdmin?: boolean;
}

function renderBlock(b: Block, key: string) {
  switch (b.kind) {
    case "h2":
      return (
        <h2 key={key} id={b.id} className="mt-10 scroll-mt-24 text-2xl font-semibold tracking-tight text-slate-100">
          {b.text}
        </h2>
      );
    case "h3":
      return (
        <h3 key={key} id={b.id} className="mt-8 scroll-mt-24 text-xl font-semibold tracking-tight text-slate-100">
          {b.text}
        </h3>
      );
    case "p":
      return (
        <p key={key} className="text-slate-200">
          {b.text}
        </p>
      );
    case "ul":
      return (
        <ul key={key} className="list-disc space-y-2 pl-6 marker:text-sky-400">
          {b.items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol key={key} className="list-decimal space-y-2 pl-6 marker:text-sky-400">
          {b.items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ol>
      );
    case "blockquote":
      return (
        <blockquote key={key} lang="en-IN" cite={b.cite} className="my-6 rounded-r-md border-l-4 border-emerald-500 bg-slate-900/40 px-5 py-3 italic text-slate-200">
          <p>{b.text}</p>
          {b.cite ? (
            <footer className="mt-2 text-sm not-italic text-slate-400">{"\u2014"} {b.cite}</footer>
          ) : null}
        </blockquote>
      );
    case "faq":
      return (
        <div key={key} className="my-5 rounded-md border border-slate-700/60 bg-slate-900/40 p-4">
          <p className="font-semibold text-slate-100">{b.q}</p>
          <p className="mt-2 text-slate-300">{b.a}</p>
        </div>
      );
    default: {
      const _exhaustive: never = b;
      return _exhaustive;
    }
  }
}

export function ArticleTextBody({ post, showHero = false, isAdmin = false }: Props) {
  const summary = textFieldsSummary(post);
  const blocks = bodyBlocksForTextView(post.body, summary);
  const toc = buildToc(blocks);
  const wordCount = countWords(post.body);
  const renderToc = shouldRenderToc(blocks, wordCount);
  const minutes = readingTime(wordCount);
  const keywords = buildKeywordList(post);
  const publishedAt = post.publishDate || post.createdAt;
  const wasUpdated =
    !!post.updatedAt &&
    new Date(post.updatedAt).getTime() > new Date(publishedAt).getTime() + 24 * 60 * 60 * 1000;

  return (
    <article itemScope itemType="https://schema.org/NewsArticle" lang="en-IN" id="article-body" className="mx-auto w-full max-w-[68ch] text-slate-100">
      <header className="mb-8 border-b border-slate-700/40 pb-6">
        {summary ? (
          <p role="doc-subtitle" itemProp="description" className="mb-5 text-lg leading-relaxed text-slate-300">
            {summary}
          </p>
        ) : (
          <p className="mb-5 text-sm leading-relaxed text-slate-500">
            No summary on text view yet {"\u2014"} add one when editing; the HTML layout keeps its own headline and intro.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-400">
          {post.author ? (
            <address className="not-italic" itemProp="author" itemScope itemType="https://schema.org/Person">
              <span className="text-slate-300">By </span>
              <span itemProp="name" className="font-medium text-slate-200">
                {post.author}
              </span>
              {post.role ? (
                <span className="text-slate-500">
                  {" \u00b7 "}
                  <span itemProp="jobTitle">{post.role}</span>
                </span>
              ) : null}
            </address>
          ) : null}

          {post.author && publishedAt ? <span aria-hidden="true">{"\u00b7"}</span> : null}

          {publishedAt ? (
            <time itemProp="datePublished" dateTime={isoDate(publishedAt)}>
              {formatIndianDate(publishedAt)}
            </time>
          ) : null}

          {wasUpdated && post.updatedAt ? (
            <>
              <span aria-hidden="true">{"\u00b7"}</span>
              <span className="text-slate-500">
                Updated{" "}
                <time itemProp="dateModified" dateTime={isoDate(post.updatedAt)}>
                  {formatIndianDate(post.updatedAt)}
                </time>
              </span>
            </>
          ) : null}

          {wordCount > 0 ? (
            <>
              <span aria-hidden="true">{"\u00b7"}</span>
              <span aria-label="Estimated reading time">{minutes} min read</span>
            </>
          ) : null}
        </div>

        {showHero && post.heroImageUrl ? (
          <figure className="mt-6">
            <img src={post.heroImageUrl} alt={post.title} width={1200} height={630} loading="eager" decoding="async" itemProp="image" className="aspect-[1200/630] w-full rounded-lg object-cover ring-1 ring-slate-700/50" />
          </figure>
        ) : null}
      </header>

      {renderToc ? (
        <nav aria-label="On this page" className="mb-8 rounded-lg border border-slate-700/50 bg-slate-900/40 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            On this page
          </p>
          <ol className="space-y-1 text-sm text-sky-300">
            {toc.map((h) => (
              <li key={h.id} className={h.level === 3 ? "pl-4" : undefined}>
                <a href={"#" + h.id} className="hover:underline">
                  {h.text}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      ) : null}

      <div itemProp="articleBody" className="space-y-5 text-[1.0625rem] leading-[1.75] text-slate-200">
        {blocks.map((b, i) => renderBlock(b, b.kind + "-" + i))}
      </div>

      {isAdmin && keywords.length > 0 ? (
        <section id="keywords" aria-labelledby="keywords-heading" className="mt-10 scroll-mt-24 rounded-xl border border-emerald-500/20 bg-emerald-950/15 p-5 sm:p-6">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 id="keywords-heading" className="text-sm font-semibold uppercase tracking-[0.14em] text-emerald-200">
              Keywords
            </h2>
            <span className="text-[11px] uppercase tracking-wide text-slate-500">
              SEO &amp; topics
            </span>
          </div>
          <p className="mb-4 text-xs leading-relaxed text-slate-400">
            Search terms this article is optimised for {"\u2014"} helps readers and search engines understand the topics covered.
          </p>
          <ul className="flex flex-wrap gap-2" role="list">
            {keywords.map((k) => (
              <li key={k}>
                <span itemProp="keywords" className="inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-950/45 px-3 py-1 text-xs font-medium text-emerald-100/95 transition hover:border-emerald-400/60 hover:bg-emerald-900/55">
                  {k}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {post.sourceLink ? (
        <p className="mt-6 text-xs text-slate-500">
          Source:{" "}
          <a href={post.sourceLink} rel="nofollow noopener external" target="_blank" className="text-sky-400 hover:underline">
            {hostnameOf(post.sourceLink)}
          </a>
        </p>
      ) : null}
    </article>
  );
}
