import "server-only";

import { createPublicSupabaseClient } from "@/integrations/supabase/server";
import { mapSupabaseNewsBlogPostRow, type NewsBlogPostRow } from "@/lib/news-blog/supabase";
import type { Post as DbPost } from "@/lib/news-blog-db";
import { normalizePost } from "@/app/news-blog/post-draft-utils";
import { findPostBySlug } from "@/app/news-blog/slug";
import type { Post } from "@/app/news-blog/types";

function rowToDbPost(row: NewsBlogPostRow): DbPost {
  return {
    id: row.id,
    portal: row.portal,
    section: row.section,
    exam: row.exam,
    title: row.title,
    summary: row.summary,
    body: row.body,
    author: row.author,
    role: row.role,
    examDate: row.examDate,
    sourceLink: row.sourceLink,
    heroImageUrl: row.heroImageUrl,
    inlineImageUrl: row.inlineImageUrl,
    heroImageCaption: row.heroImageCaption,
    inlineImageCaption: row.inlineImageCaption,
    revisionPlan: row.revisionPlan,
    featured: row.featured,
    tags: row.tags,
    publishDate: row.publishDate,
    contentFormat: row.contentFormat,
    rawHtml: row.rawHtml,
    createdAt: row.createdAt,
  };
}

export type PublicPostRow = Post & { updatedAt: string };

function rowToPublicPost(row: NewsBlogPostRow): Post | null {
  const normalized = normalizePost(rowToDbPost(row));
  if (!normalized) return null;
  return normalized;
}

async function listPublishedNewsBlogRows(): Promise<NewsBlogPostRow[]> {
  const supabase = createPublicSupabaseClient();
  const { data, error } = await supabase
    .from("news_blog_posts")
    .select("*")
    .lte("publish_date", new Date().toISOString())
    .order("publish_date", { ascending: false });

  if (error) {
    console.error("[news-blog] server-loader list:", error);
    return [];
  }

  return (data ?? []).map(mapSupabaseNewsBlogPostRow);
}

/** Published posts for SSR / sitemap (server-only). */
export async function getPublicPostsServer(): Promise<PublicPostRow[]> {
  const rows = await listPublishedNewsBlogRows();
  return rows
    .map((row) => {
      const post = rowToPublicPost(row);
      if (!post) return null;
      return { ...post, updatedAt: row.updatedAt };
    })
    .filter((p): p is PublicPostRow => p !== null);
}

export async function getPublicPostBySlugServer(slug: string): Promise<PublicPostRow | null> {
  const posts = await getPublicPostsServer();
  const found = findPostBySlug(posts, slug);
  if (!found) return null;
  return posts.find((p) => p.id === found.id) ?? null;
}
