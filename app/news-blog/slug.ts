import type { Post } from "./types";

export function slugifyTitle(title: string): string {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return (base || "post").slice(0, 80);
}

/** URL slug: `{slugified-title}-{first-8-of-id}` */
export function toPostSlug(post: Pick<Post, "id" | "title">): string {
  return `${slugifyTitle(post.title)}-${post.id.slice(0, 8).toLowerCase()}`;
}

export function postSlugPath(post: Pick<Post, "id" | "title">): string {
  return `/news-blog/${toPostSlug(post)}`;
}

/** Extract the 8-char id prefix from a post slug. */
export function parsePostIdFromSlug(slug: string): string | null {
  const match = /-([a-f0-9]{8})$/i.exec(slug);
  return match ? match[1].toLowerCase() : null;
}

export function findPostBySlug(posts: Post[], slug: string): Post | undefined {
  const prefix = parsePostIdFromSlug(slug);
  if (!prefix) return undefined;
  return posts.find((p) => p.id.toLowerCase().startsWith(prefix));
}
