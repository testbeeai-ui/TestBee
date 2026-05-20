import type { Post as DbPost } from "@/lib/news-blog/news-blog-db";

export type Portal = "news" | "blog";
export type View = "portal" | "upload";

export type NewsSection = "nbuzz" | "ndates" | "nresults" | "npapers";
export type BlogSection = "btoppers" | "btips" | "bmattitude" | "blast";
export type SectionId = NewsSection | BlogSection;

export type ExamId =
  | "all"
  | "board"
  | "jee-main"
  | "jee-advanced"
  | "state-cet"
  | "bitsat"
  | "mht-cet"
  | "other";

export type RevisionPlanId = "" | "180" | "60" | "3";

export type Post = Omit<DbPost, "portal" | "section" | "exam" | "featured"> & {
  portal: Portal;
  section: SectionId;
  exam: ExamId;
  featured: Draft["featured"];
};

export type Draft = {
  portal: Portal;
  section: SectionId | "";
  exam: ExamId;
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
  publishDate: string;
  featured: "feed" | "hero" | "sidebar";
  tags: string;
  revisionPlan: RevisionPlanId;
  contentFormat: "text" | "html";
  rawHtml: string;
};

export type HtmlPlainSource = {
  title: string;
  summary: string;
  /** Plain article body for SEO / “View text”; when set, preferred over derived text from rawHtml. */
  body: string;
  rawHtml: string;
  author?: string;
  publishDate?: string;
  createdAt?: string;
  heroImageUrl?: string;
};

export type ReferenceLink = {
  id: string;
  postId?: string;
  label: string;
  url: string;
};
