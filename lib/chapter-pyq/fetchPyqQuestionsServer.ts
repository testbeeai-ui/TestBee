import type { SupabaseClient } from "@supabase/supabase-js";
import { subjectForCatalogSlug } from "@/lib/chapter-pyq/catalog";
import {
  PYQ_COUNT_SELECT,
  PYQ_PUBLISHABLE_STATUSES,
  PYQ_QUESTION_SELECT,
  filterPublishableRows,
  sortPyqRows,
  tallyPublishableCounts,
  type PyqCountRow,
  type PyqQuestionRow,
} from "@/lib/chapter-pyq/pyqQuestionRow";
import { PYQ_PHYSICS_FIRST_YEAR } from "@/lib/chapter-pyq/pyqSets";

/** PostgREST caps a single response (default 1,000 rows), so paginate explicitly. */
const PAGE_SIZE = 1000;
const MAX_PAGES = 20;

type Page<T> = { data: T[] | null; error: { message: string } | null; count?: number | null };

/**
 * Ranges after a full first page. `null` means the total is unknown, so the
 * caller must keep walking one page at a time instead of stopping early.
 */
export function pageRangesAfterFirst(
  firstBatchLength: number,
  total: number | null | undefined
): Array<[number, number]> | null {
  if (firstBatchLength < PAGE_SIZE) return [];
  if (typeof total !== "number" || total < firstBatchLength) return null;
  const pages = Math.min(MAX_PAGES, Math.ceil(total / PAGE_SIZE));
  const ranges: Array<[number, number]> = [];
  for (let page = 1; page < pages; page++) {
    const from = page * PAGE_SIZE;
    ranges.push([from, from + PAGE_SIZE - 1]);
  }
  return ranges;
}

async function loadAllPages<T>(load: (from: number, to: number, withCount: boolean) => Promise<Page<T>>): Promise<T[]> {
  const first = await load(0, PAGE_SIZE - 1, true);
  if (first.error) throw new Error(first.error.message);
  const head = first.data ?? [];
  const ranges = pageRangesAfterFirst(head.length, first.count);
  if (ranges?.length === 0) return head;
  if (ranges) {
    const rest = await Promise.all(ranges.map(([from, to]) => load(from, to, false)));
    const rows = [...head];
    for (const part of rest) {
      if (part.error) throw new Error(part.error.message);
      rows.push(...(part.data ?? []));
    }
    return rows;
  }
  const rows = [...head];
  for (let page = 1; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE;
    const part = await load(from, from + PAGE_SIZE - 1, false);
    if (part.error) throw new Error(part.error.message);
    const batch = part.data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return rows;
}

/**
 * Year window the player serves, per subject. Physics and Chemistry are 2023
 * onward; Mathematics drops 2020. The floor matches the year chips the set
 * picker renders, so the chapter card total and the year cards inside agree.
 */
/** Oldest exam year a subject serves, or null when the subject has no floor. */
export function subjectFirstExamYear(catalogSlug: string): number | null {
  const subject = subjectForCatalogSlug(catalogSlug);
  return subject === "physics" || subject === "chemistry" ? PYQ_PHYSICS_FIRST_YEAR : null;
}

/** Row-level year window, matching the year cards the set picker renders. */
export function isWithinSubjectYearWindow(
  catalogSlug: string,
  examYear: number | null | undefined
): boolean {
  const floor = subjectFirstExamYear(catalogSlug);
  if (floor === null) return true;
  return typeof examYear === "number" && examYear >= floor;
}

/**
 * Publishable rows for one catalog chapter. The embed filters
 * `chapters.catalog_slug`, including leftover catalog chapters that are not
 * in the 2025 29-chapter TOC.
 */
export async function fetchPyqRowsForCatalogChapter(
  supabase: SupabaseClient,
  catalogSlug: string
): Promise<PyqQuestionRow[]> {
  const rows = await loadAllPages<PyqQuestionRow>(async (from, to, withCount) => {
    const { data, error, count } = await supabase
      .from("pyq_questions")
      .select(PYQ_QUESTION_SELECT, withCount ? { count: "exact" } : undefined)
      .eq("chapters.catalog_slug", catalogSlug)
      .in("review_status", [...PYQ_PUBLISHABLE_STATUSES])
      .range(from, to);
    return { data: (data ?? null) as unknown as PyqQuestionRow[] | null, error, count };
  });

  const inWindow = rows.filter((row) => isWithinSubjectYearWindow(catalogSlug, row.exam_year));
  return sortPyqRows(filterPublishableRows(inWindow));
}

/**
 * Publishable count per catalog slug for the chapter cards.
 *
 * Uses the same fill check as the set picker, so the card's `0 / N` matches
 * "N questions" inside the chapter. PostgREST cannot group, so this still
 * pages one row per publishable question — but only the columns the tally
 * needs, not figures / topics / exam metadata.
 */
export async function fetchPyqPublishableCounts(
  supabase: SupabaseClient
): Promise<Record<string, number>> {
  const rows = await loadAllPages<PyqCountRow>(async (from, to, withCount) => {
    const { data, error, count } = await supabase
      .from("pyq_questions")
      .select(PYQ_COUNT_SELECT, withCount ? { count: "exact" } : undefined)
      .in("review_status", [...PYQ_PUBLISHABLE_STATUSES])
      .range(from, to);
    return { data: (data ?? null) as unknown as PyqCountRow[] | null, error, count };
  });
  // Cards must not advertise questions the year window hides.
  const kept = rows.filter((row) => {
    const slug = row.chapters?.catalog_slug;
    return slug ? isWithinSubjectYearWindow(slug, row.exam_year) : false;
  });
  return tallyPublishableCounts(kept);
}
