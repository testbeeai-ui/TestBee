import { getExamLabel, getSectionLabel } from "./post-draft-utils";
import { postSlugPath } from "./slug";
import type { Post } from "./types";

/** Public post objects from the SSR loader may include `updatedAt` and `tags` not present on the editor draft `Post`. */
export type SeoPost = Post & { updatedAt?: string; tags?: string };

export type Block =
  | { kind: "h2"; text: string; id: string }
  | { kind: "h3"; text: string; id: string }
  | { kind: "p"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "blockquote"; text: string; cite?: string }
  | { kind: "faq"; q: string; a: string };

export interface TocItem {
  id: string;
  text: string;
  level: 2 | 3;
}

const ENDS_SENTENCE = /[.!?;:,"”]$/;
const TITLE_CASE_LINE = /^(?:[A-Z0-9][\w''\-]*\s+){1,11}[A-Z0-9][\w''\-]*$/;
const ALL_CAPS_LINE = /^[A-Z0-9][A-Z0-9\s''\-:&/]+$/;
const OL_ITEM = /^\s*(\d+)[.)]\s+(.+)$/;
const UL_ITEM = /^\s*[-*•]\s+(.+)$/;
const BQ_LINE = /^\s*>\s?(.*)$/;
const QUOTE_WRAPPED = /^["“](.+)["”]$/;
const Q_PREFIX = /^(?:Q[:.\s]\s*|Question[:\s]\s*)(.+)$/i;
const A_PREFIX = /^(?:A[:.\s]\s*|Answer[:\s]\s*)(.+)$/i;
const QUOTE_ATTRIBUTION = /\s+[—–-]\s+(.+)$/;

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

function normalize(body: string): string[] {
  return body
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/\s+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .split(/\n{2,}/);
}

function lookHeading(line: string): "h2" | null {
  if (line.length < 8 || line.length > 90) return null;
  if (ENDS_SENTENCE.test(line)) return null;
  if (line.trim().split(/\s+/).length > 12) return null;
  if (TITLE_CASE_LINE.test(line) || ALL_CAPS_LINE.test(line)) return "h2";
  return null;
}

function toTitleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w.length <= 3 ? w : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
}

function normalizeForCompare(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

/** Drop leading body paragraphs that repeat the Write-text summary (avoids duplicate under the dek). */
export function bodyBlocksForTextView(body: string, summary: string): Block[] {
  const blocks = segment(body);
  const sum = summary.trim();
  if (!sum || blocks.length === 0) return blocks;

  const sumNorm = normalizeForCompare(sum);
  let skip = 0;
  for (const b of blocks) {
    if (b.kind !== "p") break;
    const pNorm = normalizeForCompare(b.text);
    const overlaps =
      pNorm === sumNorm ||
      sumNorm.startsWith(pNorm) ||
      pNorm.startsWith(sumNorm) ||
      (pNorm.length >= 48 && sumNorm.includes(pNorm.slice(0, 48))) ||
      (sumNorm.length >= 48 && pNorm.includes(sumNorm.slice(0, 48)));
    if (overlaps) skip++;
    else break;
  }
  return blocks.slice(skip);
}

export function segment(body: string): Block[] {
  if (!body?.trim()) return [];
  const chunks = normalize(body);
  const raw: Block[] = [];
  const usedIds = new Set<string>();

  const makeId = (text: string) => {
    let id = slugify(text) || "section";
    const base = id;
    let n = 2;
    while (usedIds.has(id)) {
      id = `${base}-${n++}`;
    }
    usedIds.add(id);
    return id;
  };

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    if (lines.length >= 2 && lines.every((l) => OL_ITEM.test(l))) {
      raw.push({
        kind: "ol",
        items: lines.map((l) => l.match(OL_ITEM)![2].trim()),
      });
      continue;
    }

    if (lines.length >= 2 && lines.every((l) => UL_ITEM.test(l))) {
      raw.push({
        kind: "ul",
        items: lines.map((l) => l.match(UL_ITEM)![1].trim()),
      });
      continue;
    }

    if (lines.every((l) => BQ_LINE.test(l))) {
      const text = lines.map((l) => l.match(BQ_LINE)![1].trim()).join(" ");
      const m = text.match(QUOTE_ATTRIBUTION);
      raw.push({
        kind: "blockquote",
        text: m ? text.replace(QUOTE_ATTRIBUTION, "").trim() : text,
        cite: m?.[1]?.trim(),
      });
      continue;
    }
    if (lines.length === 1 && QUOTE_WRAPPED.test(lines[0]) && lines[0].length > 80) {
      const inner = lines[0].match(QUOTE_WRAPPED)![1];
      raw.push({ kind: "blockquote", text: inner });
      continue;
    }

    if (lines.length === 2) {
      const q = lines[0];
      const a = lines[1];
      const qMatch = q.match(Q_PREFIX);
      const aMatch = a.match(A_PREFIX);
      const looksLikeQuestion = qMatch || (q.endsWith("?") && q.length < 160);
      const looksLikeAnswer = aMatch || (!a.endsWith("?") && a.length > 0);
      if (looksLikeQuestion && looksLikeAnswer) {
        raw.push({
          kind: "faq",
          q: (qMatch?.[1] ?? q).trim(),
          a: (aMatch?.[1] ?? a).trim(),
        });
        continue;
      }
    }

    if (lines.length === 1) {
      const line = lines[0];
      const isHeading = lookHeading(line);
      const next = chunks[i + 1]?.trim();
      const nextIsParagraph =
        next &&
        !OL_ITEM.test(next.split("\n")[0]) &&
        !UL_ITEM.test(next.split("\n")[0]) &&
        !BQ_LINE.test(next.split("\n")[0]);
      if (isHeading && nextIsParagraph) {
        const text = ALL_CAPS_LINE.test(line) ? toTitleCase(line) : line;
        const prevHeading = [...raw].reverse().find((b) => b.kind === "h2" || b.kind === "h3");
        const demoteToH3 =
          prevHeading?.kind === "h2" &&
          "text" in prevHeading &&
          text.length < prevHeading.text.length;
        const kind: "h2" | "h3" = demoteToH3 ? "h3" : "h2";
        raw.push({ kind, text, id: makeId(text) });
        continue;
      }
    }

    raw.push({ kind: "p", text: lines.join(" ") });
  }

  const merged: Block[] = [];
  for (const b of raw) {
    const last = merged[merged.length - 1];
    if (
      b.kind === "p" &&
      last?.kind === "p" &&
      last.text.length < 60 &&
      b.text.length < 60 &&
      (last.text.match(/[.!?]/g) ?? []).length <= 1 &&
      (b.text.match(/[.!?]/g) ?? []).length <= 1
    ) {
      last.text = `${last.text} ${b.text}`;
    } else {
      merged.push(b);
    }
  }

  return merged;
}

export function buildToc(blocks: Block[]): TocItem[] {
  return blocks
    .filter((b): b is Extract<Block, { kind: "h2" | "h3" }> => b.kind === "h2" || b.kind === "h3")
    .map((b) => ({ id: b.id, text: b.text, level: b.kind === "h2" ? 2 : 3 }));
}

export function countWords(body: string): number {
  return body.trim().split(/\s+/).filter(Boolean).length;
}

export function shouldRenderToc(blocks: Block[], wordCount: number): boolean {
  const h2Count = blocks.filter((b) => b.kind === "h2").length;
  return h2Count >= 3 && wordCount >= 700;
}

export function readingTime(wordCount: number): number {
  return Math.max(1, Math.round(wordCount / 220));
}

export function isoDate(d: string | Date): string {
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

export function formatIndianDate(d: string | Date): string {
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

export function parseTags(csv: string | null | undefined): string[] {
  if (!csv) return [];
  return Array.from(
    new Set(
      csv
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    )
  ).slice(0, 10);
}

/**
 * SEO keyword list for a post — used by the admin-only "Keywords" block in View text,
 * the `<meta name="keywords">` tag, and the `keywords` property of NewsArticle JSON-LD.
 *
 * Priority order (so manual editorial intent wins):
 *   1. Manual `post.tags` (CSV from Write text)
 *   2. Exam label (e.g. "JEE Main")
 *   3. Section label (e.g. "Tips & tricks")
 *   4. Other exam mentions detected in the body
 *   5. A few high-signal headings from the body (H2s)
 *
 * Returns a de-duplicated, case-insensitive list capped at 12 entries.
 */
export function buildKeywordList(post: SeoPost): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (raw: string) => {
    const v = raw.trim();
    if (!v) return;
    const key = v.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(v);
  };

  for (const t of parseTags(post.tags)) push(t);

  const examLabel = getExamLabel(post.exam);
  if (examLabel && examLabel.toLowerCase() !== "all exams") push(examLabel);

  const sectionLabel = getSectionLabel(post.section);
  if (sectionLabel) push(sectionLabel);

  for (const k of EXAM_KEYWORDS) {
    if (k.id === post.exam) continue;
    if (k.pattern.test(post.body)) push(k.label);
  }

  if (out.length < 8 && post.body.trim()) {
    const blocks = segment(post.body);
    for (const b of blocks) {
      if (out.length >= 12) break;
      if (b.kind === "h2" && b.text.length >= 4 && b.text.length <= 60) {
        push(b.text.replace(/[.:;!?]+$/, ""));
      }
    }
  }

  return out.slice(0, 12);
}

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

const EXAM_SAME_AS: Record<string, string[]> = {
  "all": [],
  "board": [
    "https://en.wikipedia.org/wiki/Central_Board_of_Secondary_Education",
    "https://www.cbse.gov.in/",
  ],
  "jee-main": [
    "https://en.wikipedia.org/wiki/Joint_Entrance_Examination_%E2%80%93_Main",
    "https://jeemain.nta.nic.in/",
  ],
  "jee-advanced": [
    "https://en.wikipedia.org/wiki/Joint_Entrance_Examination_%E2%80%93_Advanced",
    "https://jeeadv.ac.in/",
  ],
  "state-cet": ["https://en.wikipedia.org/wiki/Common_Entrance_Test"],
  "bitsat": [
    "https://en.wikipedia.org/wiki/BITSAT",
    "https://www.bitsadmission.com/",
  ],
  "mht-cet": [
    "https://en.wikipedia.org/wiki/MHT-CET",
    "https://cetcell.mahacet.org/",
  ],
  "other": [],
};

const EXAM_KEYWORDS: { id: string; label: string; pattern: RegExp }[] = [
  { id: "board", label: "Board Exams", pattern: /\bboard\s+exams?\b/i },
  { id: "jee-main", label: "JEE Main", pattern: /\bJEE\s+Main\b/i },
  { id: "jee-advanced", label: "JEE Advanced", pattern: /\bJEE\s+Advanced\b/i },
  { id: "bitsat", label: "BITSAT", pattern: /\bBITSAT\b/i },
  { id: "mht-cet", label: "MHT[-\\s]CET", pattern: /\bMHT[-\s]?CET\b/i },
  { id: "state-cet", label: "State CET", pattern: /\bstate\s+CET\b/i },
];

function safeJson(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
}

export function siteBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

const PUBLISHER = {
  "@type": "Organization",
  name: "EduBlast",
};

export function buildNewsArticleLd(post: SeoPost): string {
  const base = siteBaseUrl();
  const url = `${base}${postSlugPath(post)}`;
  const published = post.publishDate || post.createdAt;
  const modified = post.updatedAt || published;
  const keywords = buildKeywordList(post);
  const wordCount = countWords(post.body);
  const examLabel = getExamLabel(post.exam);
  const aboutSameAs = EXAM_SAME_AS[post.exam] ?? [];

  const mentions = EXAM_KEYWORDS.filter(
    (k) => k.id !== post.exam && k.pattern.test(post.body)
  ).map((k) => ({
    "@type": "Thing",
    name: k.label,
    sameAs: EXAM_SAME_AS[k.id]?.[0],
  }));

  const data = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "@id": `${url}#article`,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    url,
    headline: post.title.slice(0, 110),
    description: post.summary || undefined,
    inLanguage: "en-IN",
    isAccessibleForFree: true,
    datePublished: isoDate(published),
    dateModified: isoDate(modified),
    articleSection: getSectionLabel(post.section),
    keywords: keywords.join(", ") || undefined,
    wordCount: wordCount || undefined,
    image: post.heroImageUrl
      ? {
          "@type": "ImageObject",
          url: post.heroImageUrl,
          width: 1200,
          height: 630,
        }
      : undefined,
    author: post.author
      ? {
          "@type": "Person",
          name: post.author,
          jobTitle: post.role || undefined,
        }
      : undefined,
    publisher: PUBLISHER,
    about: examLabel
      ? [
          {
            "@type": "Thing",
            name: examLabel,
            sameAs: aboutSameAs.length ? aboutSameAs : undefined,
          },
        ]
      : undefined,
    mentions: mentions.length ? mentions : undefined,
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: ['[role="doc-subtitle"]', "article h2"],
    },
    audience: {
      "@type": "EducationalAudience",
      educationalRole: "student",
      geographicArea: { "@type": "Country", name: "India" },
    },
    citation: post.sourceLink || undefined,
  };

  return safeJson(data);
}

export function buildBreadcrumbLd(post: SeoPost): string {
  const base = siteBaseUrl();
  const url = `${base}${postSlugPath(post)}`;
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "@id": `${url}#breadcrumb`,
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${base}/` },
      {
        "@type": "ListItem",
        position: 2,
        name: "News & Blogs",
        item: `${base}/news-blog`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: getExamLabel(post.exam),
        item: `${base}/news-blog?exam=${encodeURIComponent(post.exam)}`,
      },
      { "@type": "ListItem", position: 4, name: getSectionLabel(post.section) },
    ],
  };
  return safeJson(data);
}

export function buildFaqLd(blocks: Block[], post: SeoPost): string | null {
  const faqs = blocks.filter((b): b is Extract<Block, { kind: "faq" }> => b.kind === "faq");
  if (faqs.length < 2) return null;
  const base = siteBaseUrl();
  const url = `${base}${postSlugPath(post)}`;
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${url}#faq`,
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
  return safeJson(data);
}
