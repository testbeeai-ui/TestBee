export type NewsBlogPost = {
  id: string;
  portal: "news" | "blog";
  section: string;
  exam: string;
  title: string;
  summary: string;
  body: string;
  author: string;
  publishDate: string;
  contentFormat: "text" | "html";
  rawHtml: string;
  sourceLink: string;
};

export const NEWS_SECTION_LABELS: Record<string, string> = {
  nbuzz: "Exam buzz",
  ndates: "Key dates",
  nresults: "Results",
  npapers: "Papers",
};

export const BLOG_SECTION_LABELS: Record<string, string> = {
  btoppers: "Topper stories",
  btips: "Tips",
  bmattitude: "Attitude",
  blast: "Blast",
};

export function slugifyTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function postSlug(post: Pick<NewsBlogPost, "id" | "title">): string {
  return `${slugifyTitle(post.title)}-${post.id.slice(0, 8).toLowerCase()}`;
}

export function findPostBySlug(posts: NewsBlogPost[], slug: string): NewsBlogPost | undefined {
  const match = /-([a-f0-9]{8})$/i.exec(slug);
  const prefix = match?.[1]?.toLowerCase();
  if (!prefix) return undefined;
  return posts.find((p) => p.id.toLowerCase().startsWith(prefix));
}

export function stripArticleHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
