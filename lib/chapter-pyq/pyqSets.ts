/** Real-exam pacing: 2 minutes per question in the set. */
export const PYQ_SECONDS_PER_QUESTION = 120;

const TARGET_SET_SIZE = 25;

/**
 * Set count is `max(1, round(total / 25))`; sizes differ by at most one and the
 * remainder goes to the leading sets. No stub sets, ever.
 *
 * `Math.round` is half-up in JS, so 37 → 1 set and 38 → 2 sets.
 */
export function splitIntoSetSizes(total: number): number[] {
  if (!Number.isFinite(total) || total <= 0) return [];
  const count = Math.max(1, Math.round(total / TARGET_SET_SIZE));
  const base = Math.floor(total / count);
  const remainder = total % count;
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0));
}

/** Sequential slices — sets stay in the order the (filtered) list arrived in. */
export function buildPyqSets<T>(items: T[]): T[][] {
  const sizes = splitIntoSetSizes(items.length);
  const out: T[][] = [];
  let cursor = 0;
  for (const size of sizes) {
    out.push(items.slice(cursor, cursor + size));
    cursor += size;
  }
  return out;
}

export function secondsForSet(size: number): number {
  return Math.max(0, size) * PYQ_SECONDS_PER_QUESTION;
}

/**
 * Year-card copy for Mathematics. Live rows can lag a named session bank;
 * omit a slug/year to use the live set size.
 */
const MATH_YEAR_LISTED_COUNTS: Record<string, Record<string, number>> = {};

export function pyqYearSetListedCount(
  catalogSlug: string | null | undefined,
  label: string,
  liveCount: number
): number {
  if (!catalogSlug) return liveCount;
  return MATH_YEAR_LISTED_COUNTS[catalogSlug]?.[label] ?? liveCount;
}

export type PyqPracticeSet<T> = {
  label: string;
  items: T[];
};

export type PyqYearMonthEntry = {
  examYear: number | null;
  examMonth?: number | null;
  examDay?: number | null;
  examLabel: string | null;
};

function shiftRank(label: string | null): number {
  if (label && /\bMorning\b/.test(label)) return 0;
  if (label && /\bEvening\b/.test(label)) return 1;
  return 2;
}

/** Mathematics year chips start at 2021. 2020 is out of the player. */
export const PYQ_MATH_EXCLUDED_YEARS = new Set([2020]);

export function isPyqMathExcludedYear(year: number | null | undefined): boolean {
  return year != null && PYQ_MATH_EXCLUDED_YEARS.has(year);
}

/**
 * Physics and Chemistry year chips start at 2023 — four years
 * (2023, 2024, 2025, 2026). Anything older, or undated, stays out of the player.
 */
export const PYQ_PHYSICS_FIRST_YEAR = 2023;

export function isPyqPhysicsOutOfRangeYear(year: number | null | undefined): boolean {
  return year == null || year < PYQ_PHYSICS_FIRST_YEAR;
}

/** Physics and Chemistry share the 2023–2026 year cards. */
export function usesPyqSessionYearWindow(subject: string | null | undefined): boolean {
  return subject === "physics" || subject === "chemistry";
}

export function isPyqMathExcludedExamDate(examDate: string | null | undefined): boolean {
  return typeof examDate === "string" && examDate.startsWith("2020-");
}

function yearKey(entry: PyqYearMonthEntry): string | null {
  if (entry.examYear == null) return null;
  return String(entry.examYear);
}

function compareYearMonth(a: PyqYearMonthEntry, b: PyqYearMonthEntry): number {
  if (a.examYear == null && b.examYear == null) return 0;
  if (a.examYear == null) return 1;
  if (b.examYear == null) return -1;
  if (a.examYear !== b.examYear) return b.examYear - a.examYear;
  const aMonth = a.examMonth;
  const bMonth = b.examMonth;
  if ((aMonth == null) !== (bMonth == null)) return aMonth == null ? 1 : -1;
  if (aMonth != null && bMonth != null && aMonth !== bMonth) return aMonth - bMonth;
  const day = (a.examDay ?? 0) - (b.examDay ?? 0);
  if (day !== 0) return day;
  return shiftRank(a.examLabel) - shiftRank(b.examLabel);
}

/**
 * One Mathematics practice set per exam year, newest year first. Inside a
 * year, January sits before later months of that year. Undated rows stay last.
 */
export function buildPyqYearMonthSets<T extends PyqYearMonthEntry>(
  items: T[]
): PyqPracticeSet<T>[] {
  const ordered = [...items]
    .filter((item) => !isPyqMathExcludedYear(item.examYear))
    .sort(compareYearMonth);
  const out: PyqPracticeSet<T>[] = [];
  for (const item of ordered) {
    const label = yearKey(item) ?? "Undated";
    const last = out.at(-1);
    if (last && last.label === label) last.items.push(item);
    else out.push({ label, items: [item] });
  }
  return out;
}

export function buildPyqEvenPracticeSets<T>(items: T[]): PyqPracticeSet<T>[] {
  return buildPyqSets(items).map((chunk, i) => ({
    label: `Set ${i + 1}`,
    items: chunk,
  }));
}

/**
 * One practice set per exam year, newest year first, for every subject that
 * groups by year. Physics and Chemistry keep only 2023 and later; Mathematics
 * keeps its own excluded-year rule. Anything else falls back to even-sized sets.
 */
export function buildPyqSubjectPracticeSets<T extends PyqYearMonthEntry>(
  items: T[],
  subject: string | null | undefined
): PyqPracticeSet<T>[] {
  if (subject === "math") return buildPyqYearMonthSets(items);
  if (usesPyqSessionYearWindow(subject)) {
    return buildPyqYearMonthSets(
      items.filter((item) => !isPyqPhysicsOutOfRangeYear(item.examYear))
    ).filter((set) => set.label !== "Undated");
  }
  return buildPyqEvenPracticeSets(items);
}

/** Questions a subject's year window hides, so the client agrees with the server. */
export function filterPyqSubjectYearWindow<T extends PyqYearMonthEntry>(
  items: T[],
  subject: string | null | undefined
): T[] {
  if (!usesPyqSessionYearWindow(subject)) return items;
  return items.filter((item) => !isPyqPhysicsOutOfRangeYear(item.examYear));
}

/** Physics, Chemistry, and Mathematics list by year. */
export function isPyqYearGroupedSubject(subject: string | null | undefined): boolean {
  return subject === "math" || usesPyqSessionYearWindow(subject);
}

export function practiceSetSessionLabel(label: string, totalSets: number): string {
  return label.startsWith("Set ") ? `${label} of ${totalSets}` : label;
}
