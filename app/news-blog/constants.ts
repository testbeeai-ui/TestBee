import type { BlogSection, ExamId, NewsSection } from "./types";

/** News sections visible only to admins until published for everyone. */
export const ADMIN_ONLY_NEWS_SECTIONS: readonly NewsSection[] = ["nresults", "npapers"];

export const EXAMS: { id: ExamId; label: string }[] = [
  { id: "all", label: "All exams" },
  { id: "board", label: "Board exams" },
  { id: "jee-main", label: "JEE Main" },
  { id: "jee-advanced", label: "JEE Advanced" },
  { id: "state-cet", label: "State CET" },
  { id: "bitsat", label: "BITSAT" },
  { id: "mht-cet", label: "MHT-CET" },
  { id: "other", label: "Other top colleges" },
];

export const NEWS_SECTIONS: { id: NewsSection; label: string; desc: string }[] = [
  { id: "nbuzz", label: "Exam buzz", desc: "Breaking updates and exam announcements." },
  { id: "ndates", label: "Key dates", desc: "Important registration, exam, and admit card dates." },
  { id: "nresults", label: "Results & cutoffs", desc: "Result timelines and cutoff updates." },
  { id: "npapers", label: "Papers & analysis", desc: "Paper pattern insights and analysis." },
];

const ADMIN_ONLY_NEWS_SECTION_IDS = new Set<string>(ADMIN_ONLY_NEWS_SECTIONS);

export function isAdminOnlyNewsSection(section: string): section is NewsSection {
  return ADMIN_ONLY_NEWS_SECTION_IDS.has(section);
}

/** Live news sections — browsable and available in the post composer for everyone. */
export function getPublicNewsSections() {
  return NEWS_SECTIONS.filter((s) => !isAdminOnlyNewsSection(s.id));
}

/** @deprecated Alias for getPublicNewsSections — admin-only sections are never browsable yet. */
export function getBrowsableNewsSections(_isAdmin?: boolean) {
  return getPublicNewsSections();
}

/** Admin navbar preview tabs (coming soon, not clickable). */
export function getAdminPreviewNewsSections() {
  return NEWS_SECTIONS.filter((s) => isAdminOnlyNewsSection(s.id));
}

export function coerceNewsSectionForRole(section: NewsSection, _isAdmin?: boolean): NewsSection {
  if (isAdminOnlyNewsSection(section)) return "nbuzz";
  return section;
}

export const BLOG_SECTIONS: { id: BlogSection; label: string; desc: string }[] = [
  { id: "btoppers", label: "Past toppers", desc: "Real journeys, strategies, and routines." },
  {
    id: "btips",
    label: "Tips & tricks",
    desc: "Study systems and practical preparation techniques.",
  },
  {
    id: "bmattitude",
    label: "Mind & Attitude",
    desc: "Mental resilience, focus, and consistency for exam prep.",
  },
  { id: "blast", label: "Last 180/60/3d", desc: "Revision playbooks by remaining time window." },
];

export const BLOG_EDITOR_PICKS_KEY = "edublast-blog-editor-picks-v1";

export const KEY_DATE_SIDEBAR_ACCENTS: {
  border: string;
  num: string;
  numPast: string;
}[] = [
  {
    border:
      "border-emerald-500/45 bg-gradient-to-br from-emerald-900/35 to-emerald-950/50 shadow-sm shadow-emerald-950/30",
    num: "text-emerald-200",
    numPast: "text-emerald-500/80",
  },
  {
    border:
      "border-amber-500/45 bg-gradient-to-br from-amber-900/30 to-orange-950/45 shadow-sm shadow-amber-950/25",
    num: "text-amber-200",
    numPast: "text-amber-600/80",
  },
  {
    border:
      "border-teal-500/40 bg-gradient-to-br from-teal-900/28 to-lime-950/35 shadow-sm shadow-teal-950/25",
    num: "text-teal-200",
    numPast: "text-teal-600/85",
  },
];
