import type { SupabaseClient } from "@supabase/supabase-js";
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
import {
  mathPdfChaptersForCatalogSlug,
  pdfChaptersForCatalogSlug,
} from "@/lib/chapter-pyq/pdfChapterMap";
import { isPyqMathExcludedExamDate } from "@/lib/chapter-pyq/pyqSets";

/** PostgREST caps a single response (default 1,000 rows), so paginate explicitly. */
const PAGE_SIZE = 1000;
const MAX_PAGES = 20;

/**
 * Publishable rows for one catalog chapter, spanning every PDF chapter that maps
 * to it. Physics may share a slug across PDF chapters. 2025 session Maths is 1:1
 * (`catalog_slug` unique per PDF chapter number). The embed still filters
 * `chapters.catalog_slug`.
 */
export async function fetchPyqRowsForCatalogChapter(
  supabase: SupabaseClient,
  catalogSlug: string
): Promise<PyqQuestionRow[]> {
  if (
    pdfChaptersForCatalogSlug(catalogSlug).length === 0 &&
    mathPdfChaptersForCatalogSlug(catalogSlug).length === 0
  ) {
    return [];
  }

  const rows: PyqQuestionRow[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE;
    const { data, error } = await supabase
      .from("pyq_questions")
      .select(PYQ_QUESTION_SELECT)
      .eq("chapters.catalog_slug", catalogSlug)
      .in("review_status", [...PYQ_PUBLISHABLE_STATUSES])
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    const batch = (data ?? []) as unknown as PyqQuestionRow[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }

  return sortPyqRows(filterPublishableRows(rows));
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
  const rows: PyqCountRow[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE;
    const { data, error } = await supabase
      .from("pyq_questions")
      .select(PYQ_COUNT_SELECT)
      .in("review_status", [...PYQ_PUBLISHABLE_STATUSES])
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    const batch = (data ?? []) as unknown as PyqCountRow[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return tallyPublishableCounts(rows);
}
