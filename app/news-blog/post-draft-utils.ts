import type { Post as DbPost } from "@/lib/news-blog-db";

import { BLOG_SECTIONS, EXAMS, NEWS_SECTIONS } from "./constants";
import type { Draft, ExamId, Portal, Post, RevisionPlanId, SectionId } from "./types";

export function isExamId(value: string): value is ExamId {
  return EXAMS.some((e) => e.id === value);
}

/** Legacy DB slug `bmind` is accepted for blog posts and mapped to `bmattitude` in `normalizePost`. */
export function isSectionId(value: string): boolean {
  if (value === "bmind") return true;
  return NEWS_SECTIONS.some((s) => s.id === value) || BLOG_SECTIONS.some((s) => s.id === value);
}

export function isPortal(value: string): value is Portal {
  return value === "news" || value === "blog";
}

export function normalizeFeatured(raw: string | undefined): Draft["featured"] {
  if (raw === "hero" || raw === "sidebar") return raw;
  return "feed";
}

export function normalizePost(p: DbPost): Post | null {
  if (!isPortal(p.portal) || !isExamId(p.exam)) return null;
  const rawSection = String(p.section);
  if (!isSectionId(rawSection)) return null;
  if (p.portal === "news" && rawSection === "bmind") return null;
  const section: SectionId =
    p.portal === "blog" && rawSection === "bmind"
      ? "bmattitude"
      : (rawSection as SectionId);
  const rp = p.revisionPlan;
  const revisionPlan: RevisionPlanId =
    rp === "180" || rp === "60" || rp === "3" ? rp : "";
  return {
    ...p,
    portal: p.portal,
    section,
    exam: p.exam,
    revisionPlan,
    featured: normalizeFeatured(p.featured),
  };
}

/** Local calendar `YYYY-MM-DD` for `<input type="date">` (avoids UTC "yesterday" in IST). */
export function todayLocalYmd(): string {
  const n = new Date();
  const y = n.getFullYear();
  const m = String(n.getMonth() + 1).padStart(2, "0");
  const d = String(n.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function createInitialDraft(overrides?: Partial<Draft>): Draft {
  return {
    portal: "news",
    section: "",
    exam: "all",
    title: "",
    summary: "",
    body: "",
    author: "",
    role: "",
    examDate: "",
    sourceLink: "",
    heroImageUrl: "",
    inlineImageUrl: "",
    heroImageCaption: "",
    inlineImageCaption: "",
    publishDate: todayLocalYmd(),
    featured: "feed",
    tags: "",
    revisionPlan: "",
    contentFormat: "text",
    rawHtml: "",
    ...overrides,
  };
}

export function postToDraft(p: Post): Draft {
  const rp = p.revisionPlan;
  const revisionPlan: RevisionPlanId =
    rp === "180" || rp === "60" || rp === "3" ? rp : "";
  return {
    portal: p.portal,
    section: p.section,
    exam: p.exam,
    title: p.title,
    summary: p.summary,
    body: p.body,
    author: p.author,
    role: p.role,
    examDate: p.examDate,
    sourceLink: p.sourceLink,
    heroImageUrl: p.heroImageUrl,
    inlineImageUrl: p.inlineImageUrl,
    heroImageCaption: p.heroImageCaption,
    inlineImageCaption: p.inlineImageCaption,
    publishDate: isoToPublishDateField(p.publishDate || p.createdAt),
    featured: normalizeFeatured(p.featured),
    tags: "",
    revisionPlan,
    contentFormat: p.contentFormat === "html" ? "html" : "text",
    rawHtml: p.rawHtml || "",
  };
}

export function getSectionLabel(section: string): string {
  const id = section === "bmind" ? "bmattitude" : section;
  return [...NEWS_SECTIONS, ...BLOG_SECTIONS].find((s) => s.id === id)?.label ?? "";
}

export function getExamLabel(exam: string): string {
  return EXAMS.find((e) => e.id === exam)?.label ?? "All exams";
}

/** `YYYY-MM-DD` from the date picker -> ISO instant (start of that **local** calendar day). */
export function publishDateFieldToIso(value: string): string {
  const v = value.trim();
  if (!v) return new Date().toISOString();
  const d = new Date(`${v}T00:00:00`);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

/** ISO / DB timestamp -> local `YYYY-MM-DD` for the date input. */
export function isoToPublishDateField(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return todayLocalYmd();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function revisionPlanDisplayLabel(plan: string): string {
  switch (plan) {
    case "180":
      return "180 days";
    case "60":
      return "60 days";
    case "3":
      return "3 days";
    default:
      return "";
  }
}
