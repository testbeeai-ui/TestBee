import type { Subject } from "@/types";
import { learnHubSubjectPath } from "@/lib/learnhub/routes";

export const NAMED_LINK_DESTINATIONS = ["learnhub", "chapter_pyq"] as const;
export type NamedLinkDestination = (typeof NAMED_LINK_DESTINATIONS)[number];

export const NAMED_LINK_SUBJECTS = ["physics", "chemistry", "math"] as const;

/** Top-level app routes and boards. A name here would never be reached. */
const RESERVED_NAMED_SLUGS = new Set([
  "about-us",
  "admin",
  "api",
  "auth",
  "auth-choice",
  "buddy-join",
  "cbse",
  "chapter-pyq",
  "classroom",
  "classrooms",
  "contact",
  "dive",
  "doubts",
  "edudeca",
  "edudeca-mock",
  "edufund",
  "exam-prep",
  "explore",
  "explore-1",
  "home",
  "icse",
  "integrations",
  "join",
  "learnhub",
  "magic-wall",
  "mock",
  "mock-test",
  "news-blog",
  "onboarding",
  "performance",
  "play",
  "preview",
  "preview-1006-raknas-amu-tsalbude",
  "preview-raknas-amu",
  "pricing",
  "profile",
  "razorpay-demo",
  "refer-earn",
  "revision",
  "select-role",
  "settings",
  "teacher-portal",
  "terms-conditions",
  "user",
  "waitlist",
]);

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normalizeNamedSlug(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "-");
}

export function namedSlugError(raw: string): string | null {
  const slug = normalizeNamedSlug(raw);
  if (slug.length < 2 || slug.length > 40) return "Use 2 to 40 characters.";
  if (!SLUG_PATTERN.test(slug)) return "Use letters, numbers, and single hyphens only.";
  if (RESERVED_NAMED_SLUGS.has(slug)) return "That name is already a page on the site.";
  return null;
}

export function isReservedNamedSlug(slug: string): boolean {
  return RESERVED_NAMED_SLUGS.has(slug);
}

export function isNamedLinkDestination(value: string): value is NamedLinkDestination {
  return (NAMED_LINK_DESTINATIONS as readonly string[]).includes(value);
}

export function isNamedLinkSubject(value: string | null | undefined): value is Subject {
  return value === "physics" || value === "chemistry" || value === "math";
}

/** Where a saved name sends the visitor. Both pages open on the chosen subject. */
export function namedLinkHref(
  destination: NamedLinkDestination,
  subject: string | null | undefined
): string | null {
  switch (destination) {
    case "learnhub":
      return isNamedLinkSubject(subject) ? learnHubSubjectPath(subject) : null;
    case "chapter_pyq":
      return isNamedLinkSubject(subject) ? `/chapter-pyq?subject=${subject}` : "/chapter-pyq";
    default: {
      const _exhaustive: never = destination;
      return _exhaustive;
    }
  }
}
