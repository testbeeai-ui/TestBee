import { BLOG_SECTIONS, EXAMS, NEWS_SECTIONS } from "./constants";
import { postSlugPath } from "./slug";
import type { BlogSection, ExamId, NewsSection, Portal, Post, SectionId } from "./types";

export type NewsBlogListNav = {
  portal: Portal;
  section: SectionId;
  exam: ExamId;
  page: number;
};

const NEWS_SECTION_IDS = new Set<string>(NEWS_SECTIONS.map((s) => s.id));
const BLOG_SECTION_IDS = new Set<string>(BLOG_SECTIONS.map((s) => s.id));
const EXAM_IDS = new Set<string>(EXAMS.map((e) => e.id));

export function isNewsSection(id: string): id is NewsSection {
  return NEWS_SECTION_IDS.has(id);
}

export function isBlogSection(id: string): id is BlogSection {
  return BLOG_SECTION_IDS.has(id);
}

function parseExam(value: string | null): ExamId | undefined {
  if (value && EXAM_IDS.has(value)) return value as ExamId;
  return undefined;
}

function parsePage(value: string | null): number | undefined {
  if (!value) return undefined;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n >= 1 ? n : undefined;
}

export function parseListNavFromSearchParams(
  sp: URLSearchParams | { get(name: string): string | null }
): Partial<NewsBlogListNav> {
  const out: Partial<NewsBlogListNav> = {};
  const portal = sp.get("portal");
  if (portal === "news" || portal === "blog") out.portal = portal;

  const section = sp.get("section");
  if (section && (isNewsSection(section) || isBlogSection(section))) {
    out.section = section;
  }

  const exam = parseExam(sp.get("exam"));
  if (exam) out.exam = exam;

  const page = parsePage(sp.get("page"));
  if (page) out.page = page;

  return out;
}

export function normalizeListNav(partial: Partial<NewsBlogListNav>): NewsBlogListNav {
  const portal = partial.portal ?? "news";
  let section = partial.section;
  if (!section || (portal === "news" && !isNewsSection(section)) || (portal === "blog" && !isBlogSection(section))) {
    section = portal === "blog" ? "btoppers" : "nbuzz";
  }
  return {
    portal,
    section,
    exam: partial.exam ?? "all",
    page: partial.page ?? 1,
  };
}

export function serializeListNav(nav: NewsBlogListNav): string {
  const p = new URLSearchParams();
  p.set("portal", nav.portal);
  p.set("section", nav.section);
  if (nav.exam !== "all") p.set("exam", nav.exam);
  if (nav.page > 1) p.set("page", String(nav.page));
  return p.toString();
}

export function buildListHref(partial: Partial<NewsBlogListNav>): string {
  const nav = normalizeListNav(partial);
  const qs = serializeListNav(nav);
  return `/news-blog?${qs}`;
}

export function buildArticleHref(
  post: Pick<Post, "id" | "title" | "portal" | "section">,
  partial?: Partial<NewsBlogListNav>
): string {
  const nav = normalizeListNav({
    portal: partial?.portal ?? post.portal,
    section: partial?.section ?? post.section,
    exam: partial?.exam ?? "all",
    page: partial?.page ?? 1,
  });
  return `${postSlugPath(post)}?${serializeListNav(nav)}`;
}

export function searchParamsFromNext(
  raw: Record<string, string | string[] | undefined> | undefined
): URLSearchParams {
  const sp = new URLSearchParams();
  if (!raw) return sp;
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") sp.set(key, value);
    else if (Array.isArray(value) && value[0]) sp.set(key, value[0]);
  }
  return sp;
}

export function buildBackHrefFromArticleSearchParams(
  raw: Record<string, string | string[] | undefined> | undefined
): string {
  const parsed = parseListNavFromSearchParams(searchParamsFromNext(raw));
  if (!parsed.portal && !parsed.section && !parsed.exam && !parsed.page) {
    return "/news-blog";
  }
  return buildListHref(parsed);
}
