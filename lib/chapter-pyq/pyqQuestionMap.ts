import type { Question } from "@/types";
import { stripHtmlToPlain } from "@/lib/mock/catalogQuestionMap";
import { cleanPyqOcrText, pyqSolutionToHtml, pyqStemToHtml } from "@/lib/chapter-pyq/pyqOcrHtml";
import { mathPdfChaptersForCatalogSlug } from "@/lib/chapter-pyq/pdfChapterMap";
import {
  isPyqPaperFilled,
  type PyqExamShift,
  type PyqQuestionRow,
  type PyqTier,
} from "@/lib/chapter-pyq/pyqQuestionRow";

export type ChapterPyqQuestion = {
  question: Question;
  tier: PyqTier;
  /** Coarse label — `pyq_chapters.name`, the PDF chapter title (e.g. "Rotational Motion"). */
  pdfChapterName: string;
  /** Fine label — `pyq_topics.name` (e.g. "Moment of Inertia"). Null when the row has no topic. */
  topicName: string | null;
  qNo: number;
  sourcePage: number;
  /** e.g. "JAN 2024 (Evening)". Null when `exam_date` is missing. Day-of-month is never shown. */
  examLabel: string | null;
  /** Calendar year from `exam_date`. Null when the date is missing. */
  examYear: number | null;
  /** 1–12 from `exam_date`. Null when the date is missing. */
  examMonth: number | null;
  /** 1–31 from `exam_date`. Null when the date is missing. */
  examDay: number | null;
};

export type ChapterPyqQuestionBundle = {
  catalogSlug: string;
  chapterName: string;
  questions: ChapterPyqQuestion[];
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const emptyReference: Question["reference"] = {
  theory: "",
  relatedTopics: [],
  applicationExample: "",
};

export function formatPyqExamShift(shift: PyqExamShift | null): "Morning" | "Evening" | null {
  switch (shift) {
    case "morning":
      return "Morning";
    case "evening":
      return "Evening";
    case null:
      return null;
    default: {
      const _exhaustive: never = shift;
      return _exhaustive;
    }
  }
}

export function formatPyqExamLabel(
  examDate: string | null,
  shift: PyqExamShift | null
): string | null {
  if (!examDate) return null;
  const m = examDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const month = MONTHS[Number(m[2]) - 1];
  if (!month) return null;
  const date = `${month.toUpperCase()} ${m[1]}`;
  const shiftLabel = formatPyqExamShift(shift);
  return shiftLabel ? `${date} (${shiftLabel})` : date;
}

export function pyqExamYear(examDate: string | null): number | null {
  return pyqExamParts(examDate)?.year ?? null;
}

export function pyqExamMonth(examDate: string | null): number | null {
  return pyqExamParts(examDate)?.month ?? null;
}

export function pyqExamDay(examDate: string | null): number | null {
  return pyqExamParts(examDate)?.day ?? null;
}

export function pyqExamParts(
  examDate: string | null
): { year: number; month: number; day: number } | null {
  const m = examDate?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!Number.isFinite(year) || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  return { year, month, day };
}

export function splitPyqExamLabel(label: string): { date: string; shift: "Morning" | "Evening" | null } {
  const m = label.match(/^(.*)\s+\(([^)]+)\)$/);
  if (!m) return { date: label, shift: null };
  const token = m[2].trim().toLowerCase();
  if (token === "evening" || token === "e") return { date: m[1], shift: "Evening" };
  if (token === "morning" || token === "m" || token === "f") return { date: m[1], shift: "Morning" };
  return { date: label, shift: null };
}

export function pyqPaperHoverTitle(
  date: string,
  shift: "Morning" | "Evening" | null
): string {
  switch (shift) {
    case "Evening":
      return `${date} · Evening shift`;
    case "Morning":
      return `${date} · Morning shift`;
    case null:
      return date;
    default: {
      const _exhaustive: never = shift;
      return _exhaustive;
    }
  }
}

/** Paper date/shift keyed by question id. Undated rows are omitted, never guessed. */
export function pyqQuestionSources(
  entries: { question: { id: string }; examLabel: string | null }[]
): Record<string, { date: string; shift: "Morning" | "Evening" | null }> {
  const out: Record<string, { date: string; shift: "Morning" | "Evening" | null }> = {};
  for (const entry of entries) {
    if (entry.examLabel) {
      const { date } = splitPyqExamLabel(entry.examLabel);
      out[entry.question.id] = { date, shift: null };
    }
  }
  return out;
}

/** MCQ options in `option_index` order, padded to four so the shell renders a stable grid. */
function mcqOptions(row: PyqQuestionRow): string[] {
  const ordered = [...row.question_options]
    .sort((a, b) => a.option_index - b.option_index)
    .map((o) => cleanPyqOcrText(o.body ?? ""));
  while (ordered.length < 4) ordered.push("");
  return ordered.slice(0, 4);
}

/**
 * Returns null for rows the student must never see: no body, no parent
 * chapter, or an OCR fragment that is not a filled paper item.
 * Publishing status is filtered upstream by `filterPublishableRows`.
 */
export function mapPyqRowToChapterPyqQuestion(
  row: PyqQuestionRow,
  chapterFallback: string
): ChapterPyqQuestion | null {
  const body = row.body?.trim();
  if (!body || !row.chapters) return null;
  if (!isPyqPaperFilled(row)) return null;

  const pdfChapterName = row.chapters.name || chapterFallback;
  const topicName = row.topics?.name?.trim() || null;
  const isNumerical = row.format === "numerical";
  const figFolder =
    mathPdfChaptersForCatalogSlug(row.chapters.catalog_slug ?? "").length > 0
      ? "math/figures"
      : "physics/figures";
  const questionHtml = pyqStemToHtml(body, row.figure_links ?? [], figFolder);

  const solutionMd = row.solution_md?.trim() ?? "";
  const question: Question = {
    id: row.id,
    subject: "physics",
    topic: topicName ?? pdfChapterName,
    classLevel: 12,
    examType: ["JEE_Mains"],
    question: stripHtmlToPlain(questionHtml) || "Question",
    questionHtml,
    solutionHtml:
      solutionMd && !solutionMd.startsWith("{")
        ? pyqSolutionToHtml(solutionMd, row.figure_links ?? [], figFolder)
        : null,
    options: isNumerical ? [] : mcqOptions(row),
    // -1 is an out-of-range option index, not an unreachable value: a student can
    // legitimately enter -1. Scoring must branch on answerFormat first.
    correctAnswer: isNumerical ? -1 : (row.correct_option ?? 1) - 1,
    answerFormat: isNumerical ? "numerical" : "mcq",
    numericAnswer: isNumerical ? row.numerical_answer : null,
    hint: "",
    solution: solutionMd,
    coachTips: row.tips_md?.trim() || null,
    coachFormulas: row.formulas_md?.trim() || null,
    reference: emptyReference,
  };

  return {
    question,
    tier: row.tier,
    pdfChapterName,
    topicName,
    qNo: row.q_no,
    sourcePage: row.source_page,
    examLabel: formatPyqExamLabel(row.exam_date, row.exam_shift),
    examYear: pyqExamYear(row.exam_date),
    examMonth: pyqExamMonth(row.exam_date),
    examDay: pyqExamDay(row.exam_date),
  };
}

export function mapPyqRowsToChapterPyqQuestions(
  rows: PyqQuestionRow[],
  chapterName: string
): ChapterPyqQuestionBundle {
  const questions = rows
    .map((row) => mapPyqRowToChapterPyqQuestion(row, chapterName))
    .filter((q): q is ChapterPyqQuestion => q !== null);
  return {
    catalogSlug: rows[0]?.chapters?.catalog_slug ?? "",
    chapterName,
    questions,
  };
}
