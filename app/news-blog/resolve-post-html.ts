import type { Post } from "./types";

/** Prefer stored HTML; fall back to body when marked html but legacy rows lack raw_html. */
export function resolvePostHtml(post: Post): string {
  const raw = post.rawHtml.trim();
  if (raw) return raw;
  if (post.contentFormat === "html") return post.body.trim();
  return "";
}
