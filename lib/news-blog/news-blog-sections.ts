/** Stable blog `section` values stored in DB / API; keep in sync with `BlogSection` in app/news-blog/types. */
export const BLOG_SECTION_IDS = ["btoppers", "btips", "bmattitude", "blast"] as const;

/** Stable news `section` values — keep in sync with `NewsSection` in app/news-blog/types. */
export const NEWS_SECTION_IDS = ["nbuzz", "ndates", "nresults", "npapers"] as const;

export type BlogSectionId = (typeof BLOG_SECTION_IDS)[number];
export type NewsSectionId = (typeof NEWS_SECTION_IDS)[number];

export function isValidBlogSectionId(section: string): section is BlogSectionId {
  return (BLOG_SECTION_IDS as readonly string[]).includes(section);
}

export function isValidNewsSectionId(section: string): section is NewsSectionId {
  return (NEWS_SECTION_IDS as readonly string[]).includes(section);
}
