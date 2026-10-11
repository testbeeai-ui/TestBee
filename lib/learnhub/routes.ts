import type { Subject } from "@/types";

export const LEARN_HUB_PATH = "/learnhub" as const;

/** Old curriculum-browser URL; middleware forwards it to `LEARN_HUB_PATH`. */
export const LEGACY_LEARN_HUB_PATH = "/explore-1" as const;

const CANONICAL_SLUG: Record<Subject, string> = {
  physics: "physics",
  chemistry: "chemistry",
  math: "mathematics",
};

const SLUG_TO_SUBJECT: Record<string, Subject> = {
  physics: "physics",
  chemistry: "chemistry",
  mathematics: "math",
  maths: "math",
  math: "math",
};

export const LEARN_HUB_SUBJECT_TITLE: Record<Subject, string> = {
  physics: "Physics",
  chemistry: "Chemistry",
  math: "Mathematics",
};

export function learnHubSubjectSlug(subject: Subject): string {
  return CANONICAL_SLUG[subject];
}

/** Accepts canonical slugs and aliases (`maths`, `math`), case-insensitive. */
export function parseLearnHubSubjectSlug(slug: string | null | undefined): Subject | null {
  if (!slug) return null;
  return SLUG_TO_SUBJECT[slug.trim().toLowerCase()] ?? null;
}

export function learnHubSubjectPath(subject: Subject): string {
  return `${LEARN_HUB_PATH}/${learnHubSubjectSlug(subject)}`;
}

/** Re-open a unit inside a subject (used when returning from a lesson page). */
export function learnHubUnitPath(subject: Subject, classLevel: number, unitSlug: string): string {
  const qs = new URLSearchParams({ class: String(classLevel), unit: unitSlug });
  return `${learnHubSubjectPath(subject)}?${qs.toString()}`;
}

export function isLearnHubPathname(pathname: string): boolean {
  return (
    pathname === LEARN_HUB_PATH ||
    pathname.startsWith(`${LEARN_HUB_PATH}/`) ||
    pathname === LEGACY_LEARN_HUB_PATH ||
    pathname.startsWith(`${LEGACY_LEARN_HUB_PATH}/`)
  );
}

export function learnHubSubjectFromPathname(pathname: string): Subject | null {
  if (!pathname.startsWith(`${LEARN_HUB_PATH}/`)) return null;
  const [slug] = pathname.slice(LEARN_HUB_PATH.length + 1).split("/");
  return parseLearnHubSubjectSlug(slug);
}

/**
 * Where a request for a Learn Hub URL should be sent, or null when it is already canonical.
 * Handles `/explore-1` (incl. its `?subject=` query) and subject aliases like `/learnhub/maths`.
 */
export function canonicalLearnHubRedirect(
  pathname: string,
  search: URLSearchParams
): { pathname: string; search: URLSearchParams } | null {
  if (pathname === LEGACY_LEARN_HUB_PATH || pathname.startsWith(`${LEGACY_LEARN_HUB_PATH}/`)) {
    const next = new URLSearchParams(search);
    const subject = parseLearnHubSubjectSlug(next.get("subject"));
    next.delete("subject");
    return {
      pathname: subject ? learnHubSubjectPath(subject) : LEARN_HUB_PATH,
      search: next,
    };
  }

  if (!pathname.startsWith(`${LEARN_HUB_PATH}/`)) return null;
  const segments = pathname.slice(LEARN_HUB_PATH.length + 1).split("/").filter(Boolean);
  const subject = parseLearnHubSubjectSlug(segments[0]);
  if (!subject) return null;
  const canonical = learnHubSubjectPath(subject);
  if (segments.length === 1 && pathname === canonical) return null;
  return { pathname: canonical, search: new URLSearchParams(search) };
}
