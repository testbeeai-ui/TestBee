import { createAdminClient } from "@/integrations/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type NewsBlogPostRow = {
  id: string;
  portal: "news" | "blog";
  section: string;
  exam: string;
  title: string;
  summary: string;
  body: string;
  author: string;
  role: string;
  examDate: string;
  sourceLink: string;
  heroImageUrl: string;
  inlineImageUrl: string;
  heroImageCaption: string;
  inlineImageCaption: string;
  revisionPlan: string;
  featured: "feed" | "hero" | "sidebar";
  tags: string;
  publishDate: string;
  contentFormat: "text" | "html";
  rawHtml: string;
  createdAt: string;
  updatedAt: string;
};

type NewsBlogPostInsert = Omit<NewsBlogPostRow, "updatedAt"> & { updatedAt?: string };

export function mapSupabaseNewsBlogPostRow(
  row: Database["public"]["Tables"]["news_blog_posts"]["Row"]
): NewsBlogPostRow {
  const featured = row.featured;
  const normalizedFeatured: "feed" | "hero" | "sidebar" =
    featured === "hero" || featured === "sidebar" ? featured : "feed";
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
    examDate: row.exam_date,
    sourceLink: row.source_link,
    heroImageUrl: row.hero_image_url,
    inlineImageUrl: row.inline_image_url,
    heroImageCaption: row.hero_image_caption,
    inlineImageCaption: row.inline_image_caption,
    revisionPlan: row.revision_plan,
    featured: normalizedFeatured,
    tags: String(row.tags ?? ""),
    publishDate: row.publish_date,
    contentFormat: String(row.content_format ?? "text") === "html" ? "html" : "text",
    rawHtml: String(row.raw_html ?? ""),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPostToInsert(
  post: NewsBlogPostInsert
): Database["public"]["Tables"]["news_blog_posts"]["Insert"] {
  const updatedAt = post.updatedAt ?? new Date().toISOString();
  return {
    id: post.id,
    portal: post.portal,
    section: post.section,
    exam: post.exam,
    title: post.title,
    summary: post.summary,
    body: post.body || "",
    author: post.author || "",
    role: post.role || "",
    exam_date: post.examDate || "",
    source_link: post.sourceLink || "",
    hero_image_url: post.heroImageUrl || "",
    inline_image_url: post.inlineImageUrl || "",
    hero_image_caption: post.heroImageCaption || "",
    inline_image_caption: post.inlineImageCaption || "",
    revision_plan: post.revisionPlan || "",
    featured: post.featured,
    tags: post.tags ?? "",
    publish_date: post.publishDate || new Date().toISOString(),
    content_format: post.contentFormat || "text",
    raw_html: post.rawHtml || "",
    created_at: post.createdAt,
    updated_at: updatedAt,
  };
}

function getClient(): SupabaseClient<Database> {
  const client = createAdminClient();
  if (!client) {
    throw new Error(
      "[news-blog] Supabase admin client not initialized. " +
        "Ensure SUPABASE_SERVICE_ROLE_KEY is set in environment variables."
    );
  }
  return client;
}

export async function listNewsBlogPosts(): Promise<NewsBlogPostRow[]> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("news_blog_posts")
    .select("*")
    .lte("publish_date", new Date().toISOString())
    .order("publish_date", { ascending: false });

  if (error) {
    console.error("[news-blog] Error listing posts:", error);
    return [];
  }

  return (data ?? []).map(mapSupabaseNewsBlogPostRow);
}

export async function insertNewsBlogPost(row: NewsBlogPostInsert): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase.from("news_blog_posts").insert(mapPostToInsert(row));

  if (error) {
    console.error("[news-blog] Error inserting post:", error);
    throw error;
  }
}

export async function updateNewsBlogPost(row: NewsBlogPostRow): Promise<number> {
  const supabase = getClient();
  const { error } = await supabase
    .from("news_blog_posts")
    .update(mapPostToInsert(row))
    .eq("id", row.id);

  if (error) {
    console.error("[news-blog] Error updating post:", error);
    throw error;
  }

  return 1;
}

export async function deleteNewsBlogPost(id: string): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase.from("news_blog_posts").delete().eq("id", id);

  if (error) {
    console.error("[news-blog] Error deleting post:", error);
    throw error;
  }
}
