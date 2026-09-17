/**
 * Row shapes for the JEE PYQ question bank — the `pyq_`-prefixed tables the
 * sibling ingestion plan's migration creates. Table names appear exactly once,
 * in `PYQ_QUESTION_SELECT`, where each embed is aliased back to its unprefixed
 * key so these row types describe the returned JSON as-is.
 */
import {
  cleanPyqOcrText,
  isPyqSolverDumpBody,
  pyqStudentTextIsSafe,
} from "@/lib/chapter-pyq/pyqOcrHtml";

export type PyqTier = "concept_builder" | "must_do" | "advanced";

export type PyqFormat = "mcq" | "numerical" | "match_list" | "assertion_reason" | "statement";

export type PyqExamShift = "morning" | "evening";

export type PyqFigureRole = "question_body" | "option" | "match_list_item";

/** Students only ever see these. Counts use the same list. */
export const PYQ_PUBLISHABLE_STATUSES = ["auto_ok", "human_ok"] as const;

export type PyqFigureRow = {
  figure_key: string;
  /** e.g. `pyq/physics/figures/p047_x101.png` — includes the bucket as its first segment. */
  storage_path: string;
  public_url: string | null;
  alt_text: string | null;
};

export type PyqFigureLinkRow = {
  role: PyqFigureRole;
  sort_order: number | null;
  figures: PyqFigureRow | null;
};

export type PyqOptionRow = { option_index: number; body: string | null };

export type PyqChapterRow = { chapter_no: number; name: string; catalog_slug: string | null };

export type PyqQuestionRow = {
  id: string;
  q_no: number;
  tier: PyqTier;
  format: PyqFormat;
  body: string | null;
  correct_option: number | null;
  numerical_answer: string | null;
  exam_date: string | null;
  exam_shift: PyqExamShift | null;
  source_page: number;
  review_status: string;
  out_of_syllabus: boolean;
  good_to_solve: boolean;
  chapters: PyqChapterRow | null;
  topics: { name: string } | null;
  question_options: PyqOptionRow[];
  figure_links: PyqFigureLinkRow[];
  /** Worked solution markdown. Null until pyq-solutions publishes it. */
  solution_md?: string | null;
};

export const PYQ_QUESTION_SELECT = [
  "id",
  "q_no",
  "tier",
  "format",
  "body",
  "correct_option",
  "numerical_answer",
  "exam_date",
  "exam_shift",
  "source_page",
  "review_status",
  "out_of_syllabus",
  "good_to_solve",
  "solution_md",
  // Each embed is aliased to its unprefixed name, so the JSON keys stay
  // `chapters` / `topics` / `question_options` / `figure_links` / `figures`.
  // Embedded filters use the alias too, hence `.eq("chapters.catalog_slug", …)`.
  "chapters:pyq_chapters!inner(chapter_no, name, catalog_slug)",
  "topics:pyq_topics(name)",
  "question_options:pyq_question_options(option_index, body)",
  "figure_links:pyq_figure_links(role, sort_order, figures:pyq_figures(figure_key, storage_path, public_url, alt_text))",
].join(", ");

/**
 * List-card tallies only. Same fill check as the player, without figures,
 * topics, or exam metadata — those make `/api/chapter-pyq/counts` pull the
 * whole bank over the wire and trip the 25s browser abort.
 */
export const PYQ_COUNT_SELECT = [
  "review_status",
  "format",
  "body",
  "numerical_answer",
  "chapters:pyq_chapters!inner(catalog_slug)",
  "question_options:pyq_question_options(option_index, body)",
].join(", ");

/**
 * Stem + options are a complete paper item, not an OCR fragment.
 * Truncated set-builders (`$S = {x$ ∈… :`) and missing MCQ choices stay hidden
 * so the chapter card shows 0 / 0 until the row is actually filled.
 */
export function isPyqPaperFilled(row: {
  body?: string | null;
  format?: PyqFormat | null;
  numerical_answer?: string | null;
  question_options?: PyqOptionRow[] | null;
}): boolean {
  // Status-only count rows (no stem columns) used to skip this check, which
  // made the chapter card show 111 while the set picker showed ~101.
  if (row.body === undefined && row.format === undefined) return true;

  const raw = (row.body ?? "").trim();
  if (!raw || raw.startsWith("(OCR missed")) return false;
  if (isPyqSolverDumpBody(raw)) return false;
  const body = cleanPyqOcrText(raw);
  if (!body.trim()) return false;
  if (isPyqSolverDumpBody(body)) return false;
  if (!pyqStudentTextIsSafe(body)) return false;
  if (/\$[A-Za-z](?:_\{[^}]+\})?\s*=\s*\{[A-Za-z$]/.test(body)) return false;
  if (/\{[A-Za-z]\$$/.test(body)) return false;
  if (/(?:\\sqrt|√)\s*$/.test(body)) return false;
  if (
    /:\s*$/.test(body) &&
    !/\b(is|are|equal|equals|then|which|find|follows|has|represents|below|equation|intersect)\b/i.test(
      body.slice(-40)
    )
  ) {
    return false;
  }
  // Truncated tails like `, ₁/2`. A real stem may end `, is` / `, then:` / `, represents:`.
  if (
    body.length < 80 &&
    /,\s*[^,]{0,12}$/.test(body) &&
    !/,\s*(is(?:\s+equal to)?|then:?|represents:?)\s*$/i.test(body) &&
    !/\b(?:is:?|are:?|equal to:?)\s*$/i.test(body)
  ) {
    return false;
  }
  if (body.length < 50 && /[₀-₉ⁿ¹-⁹]/.test(body) && !body.includes("$")) return false;

  const format = row.format;
  if (format == null) return true;

  switch (format) {
    case "numerical":
      return Boolean(row.numerical_answer?.trim());
    case "mcq": {
      const texts = [...(row.question_options ?? [])]
        .sort((a, b) => a.option_index - b.option_index)
        .slice(0, 4)
        .map((o) => cleanPyqOcrText(o.body ?? "").trim());
      if (texts.length < 4 || texts.some((t) => !t)) return false;
      if (texts.some((t) => !pyqStudentTextIsSafe(t))) return false;
      return !texts.some((t) => /\b(Inequalities|MUST DO|CONCEPT BUILDER|ADVANCED)\b/i.test(t) && t.length < 48);
    }
    case "match_list":
    case "assertion_reason":
    case "statement":
      return false;
    default: {
      const _exhaustive: never = format;
      return _exhaustive;
    }
  }
}

/** Defence in depth: the DB query already filters, this guarantees it. */
export function filterPublishableRows(rows: PyqQuestionRow[]): PyqQuestionRow[] {
  const allowed = new Set<string>(PYQ_PUBLISHABLE_STATUSES);
  return rows.filter((row) => allowed.has(row.review_status) && isPyqPaperFilled(row));
}

/** Merged pages group by PDF chapter first, then by the book's own question number. */
export function sortPyqRows(rows: PyqQuestionRow[]): PyqQuestionRow[] {
  return [...rows].sort((a, b) => {
    const ca = a.chapters?.chapter_no ?? Number.MAX_SAFE_INTEGER;
    const cb = b.chapters?.chapter_no ?? Number.MAX_SAFE_INTEGER;
    if (ca !== cb) return ca - cb;
    return a.q_no - b.q_no;
  });
}

export type PyqCountRow = {
  review_status: string;
  body?: string | null;
  format?: PyqFormat | null;
  numerical_answer?: string | null;
  question_options?: PyqOptionRow[] | null;
  chapters: { catalog_slug: string | null } | null;
};

/** Publishable questions per catalog slug. Rows with no slug (deferred) are dropped. */
export function tallyPublishableCounts(rows: PyqCountRow[]): Record<string, number> {
  const allowed = new Set<string>(PYQ_PUBLISHABLE_STATUSES);
  const out: Record<string, number> = {};
  for (const row of rows) {
    if (!allowed.has(row.review_status)) continue;
    if (!isPyqPaperFilled(row)) continue;
    const slug = row.chapters?.catalog_slug;
    if (!slug) continue;
    out[slug] = (out[slug] ?? 0) + 1;
  }
  return out;
}
