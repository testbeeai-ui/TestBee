import { supabase } from "@/integrations/supabase/client";

import { displayTitleFromMockPaperRow } from "@/lib/mock/mockPaperCatalogTitle";

import { enrichMockLibraryHistory } from "@/lib/mock/enrichMockLibraryHistory";

import { parseSubjectBreakdownJson, type MockSubjectScore } from "@/lib/mock/mockTestAttemptTypes";

export type MockLibraryHistoryKind = "past_paper" | "mock_paper" | "quick_mock" | "mcq_chapter";

export type MockLibraryHistorySource = "recorded_attempt" | "catalog_attempt" | "community_share";

export type MockLibraryHistoryEntry = {
  id: string;

  kind: MockLibraryHistoryKind;

  title: string;

  scorePercent: number | null;

  correct: number | null;

  total: number | null;

  eligible: boolean;

  rdmAwarded: number;

  takenAt: string;

  paperSlug: string | null;

  denialReason: string | null;

  source: MockLibraryHistorySource;

  attemptKey: string | null;

  catalogPaperId: string | null;

  pastPaperId: string | null;

  subjectScores: MockSubjectScore[];

  /** 1-based attempt number on this paper (chronological). */

  attemptIndexOnPaper?: number;

  attemptCountOnPaper?: number;

  /** Overall % change vs previous attempt on same paper; null if first attempt. */

  deltaPercentVsPrevious?: number | null;

  /** Extra correct answers vs previous attempt on same paper. */

  deltaCorrectVsPrevious?: number | null;
};

type RecordedAttemptRow = {
  id: string;

  attempt_key: string;

  session_kind: string;

  catalog_paper_id: string | null;

  past_paper_id: string | null;

  paper_slug: string | null;

  paper_title: string;

  score_percent: number | null;

  correct_count: number | null;

  total_questions: number | null;

  subject_breakdown: unknown;

  created_at: string;
};

type CatalogAttemptRow = {
  id: string;

  eligible: boolean;

  score_percent: number | null;

  correct_count: number | null;

  total_questions: number | null;

  denial_reason: string | null;

  rdm_awarded: number;

  created_at: string;

  mock_papers: {
    id: string;

    slug: string;

    title: string;

    exam_name: string | null;

    exam_set_name: string | null;

    paper_type: string;
  } | null;
};

type CommunityRow = {
  id: string;

  title: string;

  created_at: string;

  source_type: string | null;

  source_payload: Record<string, unknown> | null;
};

function kindFromPaperType(paperType: string): MockLibraryHistoryKind {
  if (paperType === "pyq") return "past_paper";

  if (paperType === "chapter") return "mcq_chapter";

  return "mock_paper";
}

function kindFromCommunity(
  sourceType: string | null,

  payload: Record<string, unknown> | null
): MockLibraryHistoryKind {
  if (sourceType === "past_paper_result") return "past_paper";

  const shareKind = typeof payload?.sharePaperKind === "string" ? payload.sharePaperKind : "";

  if (shareKind === "past_paper") return "past_paper";

  const paperId = payload?.paperId;

  const attemptKey = typeof payload?.attemptKey === "string" ? payload.attemptKey : "";

  if (!paperId && attemptKey.includes("quick")) return "quick_mock";

  return "mock_paper";
}

function mapRecordedRow(row: RecordedAttemptRow): MockLibraryHistoryEntry {
  const kind = row.session_kind as MockLibraryHistoryKind;

  return {
    id: `recorded:${row.id}`,

    kind,

    title: row.paper_title.trim() || "Mock session",

    scorePercent: row.score_percent,

    correct: row.correct_count,

    total: row.total_questions,

    eligible: row.score_percent != null && row.score_percent >= 60,

    rdmAwarded: 0,

    takenAt: row.created_at,

    paperSlug: row.paper_slug,

    denialReason: null,

    source: "recorded_attempt",

    attemptKey: row.attempt_key,

    catalogPaperId: row.catalog_paper_id,

    pastPaperId: row.past_paper_id,

    subjectScores: parseSubjectBreakdownJson(row.subject_breakdown),
  };
}

function mapCatalogRow(row: CatalogAttemptRow): MockLibraryHistoryEntry | null {
  const paper = row.mock_papers;

  if (!paper) return null;

  const title = displayTitleFromMockPaperRow({
    title: paper.title,

    exam_name: paper.exam_name,

    exam_set_name: paper.exam_set_name,

    tags: null,
  });

  return {
    id: `catalog:${row.id}`,

    kind: kindFromPaperType(paper.paper_type),

    title,

    scorePercent: row.score_percent,

    correct: row.correct_count,

    total: row.total_questions,

    eligible: row.eligible,

    rdmAwarded: row.rdm_awarded ?? 0,

    takenAt: row.created_at,

    paperSlug: paper.slug,

    denialReason: row.denial_reason,

    source: "catalog_attempt",

    attemptKey: null,

    catalogPaperId: paper.id,

    pastPaperId: null,

    subjectScores: [],
  };
}

function mapCommunityRow(row: CommunityRow): MockLibraryHistoryEntry {
  const payload = row.source_payload ?? {};

  const correct = typeof payload.correct === "number" ? payload.correct : null;

  const total = typeof payload.total === "number" ? payload.total : null;

  let scorePercent: number | null = null;

  if (correct != null && total != null && total > 0) {
    scorePercent = Math.round((correct / total) * 1000) / 10;
  }

  const slug =
    typeof payload.paperSlug === "string" && payload.paperSlug.trim()
      ? payload.paperSlug.trim()
      : null;

  const paperId = typeof payload.paperId === "string" ? payload.paperId : null;

  const attemptKey =
    typeof payload.attemptKey === "string" && payload.attemptKey.trim()
      ? payload.attemptKey.trim()
      : null;

  const subjectScores = parseSubjectBreakdownJson(payload.subjectBreakdown);

  return {
    id: `community:${row.id}`,

    kind: kindFromCommunity(row.source_type, payload),

    title: row.title.trim() || "Mock session",

    scorePercent,

    correct,

    total,

    eligible: scorePercent != null && scorePercent >= 60,

    rdmAwarded: 0,

    takenAt: row.created_at,

    paperSlug: slug,

    denialReason: null,

    source: "community_share",

    attemptKey,

    catalogPaperId: paperId,

    pastPaperId: null,

    subjectScores,
  };
}

export function filterHistoryByLibraryTab(
  entries: MockLibraryHistoryEntry[],

  tab: "past" | "mock" | "quick" | "mcq"
): MockLibraryHistoryEntry[] {
  switch (tab) {
    case "past":
      return entries.filter((e) => e.kind === "past_paper");

    case "mock":
      return entries.filter((e) => e.kind === "mock_paper");

    case "quick":
      return entries.filter((e) => e.kind === "quick_mock");

    case "mcq":
      return entries.filter((e) => e.kind === "mcq_chapter");

    default:
      return entries;
  }
}

/**

 * Loads all attempts (including retakes on the same paper), enriches with improvement metadata.

 * Primary: mock_test_attempts. Legacy: mock_rdm_bonus_attempts + community shares not already recorded.

 */

export async function fetchMockLibraryHistory(userId: string): Promise<MockLibraryHistoryEntry[]> {
  const [recordedRes, catalogRes, communityRes] = await Promise.all([
    supabase

      .from("mock_test_attempts")

      .select(
        "id, attempt_key, session_kind, catalog_paper_id, past_paper_id, paper_slug, paper_title, score_percent, correct_count, total_questions, subject_breakdown, created_at"
      )

      .eq("user_id", userId)

      .order("created_at", { ascending: false })

      .limit(120),

    supabase

      .from("mock_rdm_bonus_attempts")

      .select(
        "id, eligible, score_percent, correct_count, total_questions, denial_reason, rdm_awarded, created_at, mock_papers(id, slug, title, exam_name, exam_set_name, paper_type)"
      )

      .eq("user_id", userId)

      .order("created_at", { ascending: false })

      .limit(120),

    supabase

      .from("lessons_raw_posts")

      .select("id, title, created_at, source_type, source_payload")

      .eq("user_id", userId)

      .in("source_type", ["mock_test", "past_paper_result"])

      .order("created_at", { ascending: false })

      .limit(60),
  ]);

  if (recordedRes.error) {
    if (recordedRes.error.code === "42P01") {
      // Table not migrated yet — fall through to legacy sources only.
    } else {
      throw recordedRes.error;
    }
  }

  if (catalogRes.error) throw catalogRes.error;

  if (communityRes.error) throw communityRes.error;

  const recorded = (recordedRes.data ?? [])

    .map((r) => mapRecordedRow(r as unknown as RecordedAttemptRow))

    .filter((e): e is MockLibraryHistoryEntry => e != null);

  const recordedAttemptKeys = new Set(
    recorded.map((e) => e.attemptKey).filter((k): k is string => Boolean(k))
  );

  const catalog = (catalogRes.data ?? [])
    .map((r) => mapCatalogRow(r as unknown as CatalogAttemptRow))
    .filter((e): e is MockLibraryHistoryEntry => e != null)
    .filter((e) => {
      return !recorded.some(
        (r) =>
          r.catalogPaperId != null &&
          r.catalogPaperId === e.catalogPaperId &&
          r.scorePercent === e.scorePercent &&
          r.correct === e.correct &&
          r.total === e.total &&
          Math.abs(Date.parse(r.takenAt) - Date.parse(e.takenAt)) < 120_000
      );
    });

  const community = (communityRes.data ?? [])

    .filter((r) => {
      const payload = (r as CommunityRow).source_payload;

      const attemptKey = typeof payload?.attemptKey === "string" ? payload.attemptKey.trim() : "";

      if (attemptKey && recordedAttemptKeys.has(attemptKey)) return false;

      return true;
    })

    .map((r) => mapCommunityRow(r as unknown as CommunityRow));

  const merged = [...recorded, ...catalog, ...community].sort(
    (a, b) => Date.parse(b.takenAt) - Date.parse(a.takenAt)
  );

  return enrichMockLibraryHistory(merged);
}
