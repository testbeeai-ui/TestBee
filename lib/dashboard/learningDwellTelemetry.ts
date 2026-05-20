import type { Board, Subject } from "@/types";
import type { DifficultyLevel } from "@/lib/slugs";

export type LearningDwellPanel = "theory" | "bits" | "numerals" | "instacue";

export type LearningDwellScope = {
  board: Board;
  subject: Subject;
  classLevel: 11 | 12;
  topic: string;
  subtopicName: string;
  level: DifficultyLevel;
};

export type LearningDwellClientEvent = {
  deltaMs: number;
  panel: LearningDwellPanel;
  scope: LearningDwellScope;
  bitsQuestionIndex?: number | null;
  occurredAt?: string;
};

const MAX_DELTA_MS = 300_000;
const MIN_DELTA_MS = 1_000;

export function mapTopicPanelTabToDwellPanel(
  tab: "instacue" | "quiz" | "numerals" | "concepts"
): LearningDwellPanel {
  switch (tab) {
    case "instacue":
      return "instacue";
    case "quiz":
      return "bits";
    case "numerals":
      return "numerals";
    case "concepts":
    default:
      return "theory";
  }
}

export function clampDeltaMs(raw: number): number {
  if (!Number.isFinite(raw)) return 0;
  const n = Math.trunc(raw);
  if (n < MIN_DELTA_MS) return 0;
  return Math.min(n, MAX_DELTA_MS);
}

export function normalizeBoardParam(board: string): Board {
  return String(board).toUpperCase() === "ICSE" ? "ICSE" : "CBSE";
}
