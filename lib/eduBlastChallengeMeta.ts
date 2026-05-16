import type { PlayDomain } from "@/types";

/** Fallback when no options time remains (e.g. timeout at 0). */
export const RESULT_FLASH_SEC = 1;
export const RESULT_FLASH_MS = RESULT_FLASH_SEC * 1000;
/** @deprecated Use RESULT_FLASH_MS */
export const RESULT_REVIEW_MS = RESULT_FLASH_MS;

/** Use leftover options-phase seconds for result + explanation after an early submit. */
export function remainingOptionsReviewMs(
  secondsLeft: number,
  optionsPhaseSec: number,
  minSec = 1
): number {
  const left = Math.max(minSec, Math.min(Math.ceil(secondsLeft), optionsPhaseSec));
  return left * 1000;
}

export function formatEduBlastClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function difficultyRatingToLabel(rating: number): string {
  if (rating <= 2) return "Easy";
  if (rating <= 4) return "Medium";
  return "Hard";
}

const CATEGORY_SUBJECT: Record<string, string> = {
  physics: "⚡ Physics",
  chemistry: "⚗ Chemistry",
  math: "📐 Mathematics",
  cs: "💻 Computer Science",
  mental_math: "⚡ Mental Math",
  verbal: "📝 Verbal",
  quant: "🔢 Quantitative",
  analytical: "🧩 Analytical",
  puzzles: "🧩 Puzzles",
  gk: "🌍 General Knowledge",
};

export function playCategoryToSubjectTag(
  category: string | undefined,
  domain: PlayDomain
): string {
  if (category && CATEGORY_SUBJECT[category]) {
    return CATEGORY_SUBJECT[category];
  }
  return domain === "academic" ? "📚 Academic" : "🧠 Funbrain";
}

export type EduBlastDotState = "pending" | "current" | "correct" | "wrong" | "skip";

export function buildEduBlastDotStates(
  total: number,
  currentIndex: number,
  outcomes: ("correct" | "wrong" | "skip")[]
): EduBlastDotState[] {
  return Array.from({ length: total }, (_, i) => {
    if (i < outcomes.length) return outcomes[i] === "correct" ? "correct" : outcomes[i] === "skip" ? "skip" : "wrong";
    if (i === currentIndex) return "current";
    return "pending";
  });
}
