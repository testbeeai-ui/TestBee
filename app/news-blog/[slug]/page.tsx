import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/integrations/supabase/server";
import { isAdminUser } from "@/lib/admin";
import { isAdminOnlyNewsSection } from "@/app/news-blog/constants";
import { getPublicPostBySlugServer, getPublicPostsServer } from "@/lib/news-blog/server-loader";
import { feedCardBlurb, htmlToSeoSafeDocument } from "../html-feed-and-seo";
import {
  buildBreadcrumbLd,
  buildFaqLd,
  buildKeywordList,
  buildNewsArticleLd,
  segment,
} from "../article-segment";
import { getExamLabel, getSectionLabel, revisionPlanDisplayLabel } from "../post-draft-utils";
import { buildBackHrefFromArticleSearchParams, buildListHref } from "../nav-query";
import { postSlugPath, toPostSlug } from "../slug";
import { PublicShell } from "../PublicShell";
import { ArticlePageContent } from "../components/ArticlePageContent";
import { resolvePostHtml } from "../resolve-post-html";

export const revalidate = 60;

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function getIsLoggedIn(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_complete")
    .eq("id", user.id)
    .maybeSingle();
  return Boolean(profile?.onboarding_complete);
}

async function getIsAppAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  return isAdminUser(supabase, user.id);
}

export async function generateStaticParams() {
  const posts = await getPublicPostsServer();
  return posts
    .filter((post) => post.portal !== "news" || !isAdminOnlyNewsSection(post.section))
    .map((post) => ({ slug: toPostSlug(post) }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublicPostBySlugServer(slug);
  if (!post) {
    return { title: "Article not found · EduBlast" };
  }

  const description = feedCardBlurb(post).slice(0, 160) || post.title;
  const canonicalPath = postSlugPath(post);
  const keywords = buildKeywordList(post);

  return {
    title: `${post.title} · EduBlast`,
    description,
    keywords: keywords.length > 0 ? keywords : undefined,
    alternates: { canonical: canonicalPath },
    openGraph: {
      title: post.title,
      description,
      type: "article",
      publishedTime: post.publishDate || post.createdAt,
      modifiedTime: post.updatedAt || post.createdAt,
      url: canonicalPath,
      images: post.heroImageUrl ? [{ url: post.heroImageUrl }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description,
    },
  };
}

function seoArticleBody(post: Awaited<ReturnType<typeof getPublicPostBySlugServer>>) {
  if (!post) return "";
  const html = resolvePostHtml(post);
  if (html) {
    return htmlToSeoSafeDocument(html);
  }
  const plain = [post.summary, post.body].filter(Boolean).join("\n\n");
  if (!plain.trim()) return "";
  return plain
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`)
    .join("");
}

export default async function NewsBlogArticlePage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const [post, isLoggedIn, isAdmin] = await Promise.all([
    getPublicPostBySlugServer(slug),
    getIsLoggedIn(),
    getIsAppAdmin(),
  ]);

  if (!post) notFound();
  if (!isAdmin && post.portal === "news" && isAdminOnlyNewsSection(post.section)) {
    notFound();
  }

  const backFromQuery = buildBackHrefFromArticleSearchParams(query);
  const backHref =
    backFromQuery !== "/news-blog"
      ? backFromQuery
      : buildListHref({ portal: post.portal, section: post.section });

  const hasRichHtml = resolvePostHtml(post).length > 0;
  const seoHtml = seoArticleBody(post);

  const newsArticleLd = buildNewsArticleLd(post);
  const breadcrumbLd = buildBreadcrumbLd(post);
  const faqLd = buildFaqLd(segment(post.body), post);

  return (
    <PublicShell isLoggedIn={isLoggedIn}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: newsArticleLd }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbLd }} />
      {faqLd ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqLd }} />
      ) : null}

      <article className="mx-auto w-full max-w-3xl overflow-visible rounded-xl border border-slate-600/30 bg-[#151d2e] text-slate-100 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.35)] ring-1 ring-cyan-950/25 sm:rounded-2xl lg:max-w-4xl">
        <div className="border-b border-slate-600/25 bg-gradient-to-r from-[#182536] via-[#141d2c] to-[#182536] px-4 py-3 sm:px-6">
          <Link
            href={backHref}
            className="group inline-flex items-center gap-2 rounded-lg border border-slate-600/40 bg-[#0f1826]/70 px-3 py-1.5 text-sm font-medium text-sky-200 shadow-sm shadow-black/20 backdrop-blur-sm transition hover:border-sky-500/50 hover:bg-sky-950/30 hover:text-sky-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
          >
            <ArrowLeft
              className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:-translate-x-0.5"
              aria-hidden
            />
            <span>Back to News &amp; Blogs</span>
          </Link>
        </div>

        <div className="p-3.5 sm:p-6 lg:p-8">
          <div className="mb-4 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-[#0d1e30] px-2.5 py-0.5 font-medium text-blue-200/95">
              {getExamLabel(post.exam)}
            </span>
            <span className="rounded-full bg-[#171425] px-2.5 py-0.5 font-medium text-violet-200/95">
              {getSectionLabel(post.section)}
            </span>
            {post.section === "blast" && post.revisionPlan ? (
              <span className="rounded-full border border-rose-500/40 bg-rose-950/40 px-2.5 py-0.5 font-medium text-rose-100/90">
                {revisionPlanDisplayLabel(post.revisionPlan)}
              </span>
            ) : null}
          </div>

          {hasRichHtml && seoHtml ? (
            <section
              className="sr-only"
              aria-label="Article text for search engines"
              dangerouslySetInnerHTML={{ __html: seoHtml }}
            />
          ) : null}

          <ArticlePageContent post={post} isAdmin={isAdmin} />

        </div>
      </article>
    </PublicShell>
  );
}
