/**
 * One-time (idempotent): copy rows from news-blog.local.sqlite -> Supabase news_blog_posts.
 *
 * Prerequisites:
 *   - Migration 20260516010000_news_blog_posts_tags.sql applied (tags column exists).
 *   - Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   npx tsx --env-file-if-exists=.env scripts/migrate-news-blog-sqlite-to-supabase.ts
 *
 * Optional: SQLITE_PATH=./path/to/news-blog.local.sqlite
 */

import fs from "node:fs";
import path from "node:path";
import SqliteDatabase from "better-sqlite3";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../integrations/supabase/types";

type NewsBlogInsert = Database["public"]["Tables"]["news_blog_posts"]["Insert"];

const DEFAULT_SQLITE = path.join(process.cwd(), "news-blog.local.sqlite");

function toIso(s: unknown): string {
  const t = String(s ?? "").trim();
  if (!t) return new Date().toISOString();
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function rowToInsert(row: Record<string, unknown>): NewsBlogInsert {
  const featured = String(row.featured ?? "feed");
  const normalizedFeatured = featured === "hero" || featured === "sidebar" ? featured : "feed";
  const portal = String(row.portal) === "blog" ? "blog" : "news";
  const contentFormat = String(row.content_format ?? "text") === "html" ? "html" : "text";

  return {
    id: String(row.id),
    portal,
    section: String(row.section ?? ""),
    exam: String(row.exam ?? "all"),
    title: String(row.title ?? ""),
    summary: String(row.summary ?? ""),
    body: String(row.body ?? ""),
    author: String(row.author ?? ""),
    role: String(row.role ?? ""),
    exam_date: String(row.exam_date ?? ""),
    source_link: String(row.source_link ?? ""),
    hero_image_url: String(row.hero_image_url ?? ""),
    inline_image_url: String(row.inline_image_url ?? ""),
    hero_image_caption: String(row.hero_image_caption ?? ""),
    inline_image_caption: String(row.inline_image_caption ?? ""),
    revision_plan: String(row.revision_plan ?? ""),
    featured: normalizedFeatured as "feed" | "hero" | "sidebar",
    tags: String(row.tags ?? ""),
    publish_date: toIso(row.publish_date),
    content_format: contentFormat,
    raw_html: String(row.raw_html ?? ""),
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  };
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const sqlitePath = process.env.SQLITE_PATH ?? DEFAULT_SQLITE;
  if (!fs.existsSync(sqlitePath)) {
    console.error("SQLite file not found:", sqlitePath);
    console.error("Nothing to migrate.");
    process.exit(0);
  }

  const db = new SqliteDatabase(sqlitePath, { readonly: true });
  let rows: Record<string, unknown>[];
  try {
    rows = db.prepare("SELECT * FROM news_blog_posts").all() as Record<string, unknown>[];
  } catch (e) {
    console.error("Failed to read news_blog_posts:", e);
    process.exit(1);
  } finally {
    db.close();
  }

  if (rows.length === 0) {
    console.log("No rows in SQLite; nothing to upsert.");
    process.exit(0);
  }

  const supabase = createClient<Database>(url, key, { auth: { persistSession: false } });
  const inserts = rows.map(rowToInsert);

  const CHUNK = 50;
  for (let i = 0; i < inserts.length; i += CHUNK) {
    const slice = inserts.slice(i, i + CHUNK);
    const { error } = await supabase.from("news_blog_posts").upsert(slice, { onConflict: "id" });
    if (error) {
      console.error("Upsert chunk failed at offset", i, error);
      process.exit(1);
    }
    console.log("Upserted", Math.min(i + CHUNK, inserts.length), "/", inserts.length);
  }

  console.log("Done. Migrated", inserts.length, "post(s) from", sqlitePath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
