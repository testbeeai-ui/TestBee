import type { SubtopicEngagementSnapshot } from "@/lib/curriculum/subtopicEngagementService";
import { parseEngagementStore } from "@/lib/curriculum/subtopicEngagementStoreParse";
import type { Json } from "@/integrations/supabase/types";
import type { DifficultyLevel } from "@/lib/slugs";
import { makeSubtopicEngagementStorageKey } from "@/lib/curriculum/subtopicEngagementStorageKey";
import { normalizeBoardParam } from "@/lib/dashboard/learningDwellTelemetry";
import type { Subject } from "@/types";

/** Explains coarse heartbeat telemetry (~15s) shown in admin Learning map dwell columns. */
export const STUDENT_DWELL_TELEMETRY_NOTE =
  "Dwell times aggregate heartbeat samples while the subtopic page tab is visible (~15s resolution); panel switches may lag by one interval. Not per-bit forensic timing.";

export const MAX_SUBTOPIC_INSIGHT_ROWS = 100;
export const MAX_COMMUNITY_ITEMS = 40;
export const MAX_CLASSROOM_PROGRESS_ROWS = 200;
export const MAX_DOUBTS_LIST = 30;
export const MAX_CHAT_MESSAGES = 50;

export type EngagementScopeParts = {
  storageKey: string;
  board: string;
  subject: string;
  classLevel: number | null;
  topic: string;
  subtopicName: string;
  level: string;
  keyWellFormed: boolean;
};

export type SubtopicInsightSummary = {
  lessonChecklistMarkedCompleteAt: string | null;
  lessonFocusTimer: {
    secondsRemaining: number;
    running: boolean;
    everStarted?: boolean;
  } | null;
  bitsCurrentIdx: number | null;
  bitsVisitedCount: number;
  bitsGraded: {
    answered: number;
    correct: number;
    wrong: number;
    totalQuestions: number;
  } | null;
  instaCueNavVisitedCount: number;
  instaCueFlippedCount: number;
  numeralsFormulaSlots: number;
  conceptsPagesCount: number;
  updatedAt: string;
};

export type SubtopicInsightRow = EngagementScopeParts & {
  summary: SubtopicInsightSummary;
};

export type DwellMsByPanel = { theory: number; bits: number; numerals: number; instacue: number };

const ZERO_DWELL: DwellMsByPanel = { theory: 0, bits: 0, numerals: 0, instacue: 0 };

export type SubtopicInsightRowWithDwell = SubtopicInsightRow & {
  dwellMsByPanel: DwellMsByPanel;
};

export function rollupDwellEvents(
  events: Array<{
    board: string;
    subject: string;
    class_level: number;
    topic: string;
    subtopic_name: string;
    level: string;
    panel: string;
    delta_ms: number;
  }>
): Map<string, DwellMsByPanel> {
  const map = new Map<string, DwellMsByPanel>();
  for (const e of events) {
    const panel = e.panel;
    if (panel !== "theory" && panel !== "bits" && panel !== "numerals" && panel !== "instacue") {
      continue;
    }
    const classLevel = Number(e.class_level);
    if (classLevel !== 11 && classLevel !== 12) continue;
    const subject = String(e.subject ?? "").toLowerCase();
    if (!["physics", "chemistry", "math"].includes(subject)) continue;
    const level = String(e.level ?? "").toLowerCase();
    if (!["basics", "intermediate", "advanced"].includes(level)) continue;
    const topic = String(e.topic ?? "").trim();
    const subtopicName = String(e.subtopic_name ?? "").trim();
    if (!topic || !subtopicName) continue;
    const delta = Number(e.delta_ms);
    if (!Number.isFinite(delta) || delta <= 0) continue;

    const key = makeSubtopicEngagementStorageKey({
      board: normalizeBoardParam(e.board),
      subject: subject as Subject,
      classLevel: classLevel as 11 | 12,
      topic,
      subtopicName,
      level: level as DifficultyLevel,
    });

    const row = map.get(key) ?? { ...ZERO_DWELL };
    row[panel] += Math.round(delta);
    map.set(key, row);
  }
  return map;
}

export function mergeDwellIntoSubtopicRows(
  rows: SubtopicInsightRow[],
  rollup: Map<string, DwellMsByPanel>
): SubtopicInsightRowWithDwell[] {
  return rows.map((row) => ({
    ...row,
    dwellMsByPanel: rollup.get(row.storageKey) ?? { ...ZERO_DWELL },
  }));
}

export function splitEngagementStorageKey(
  storageKey: string
): Omit<EngagementScopeParts, "storageKey"> {
  const parts = storageKey.split("||");
  if (parts.length !== 6) {
    return {
      board: "",
      subject: "",
      classLevel: null,
      topic: "",
      subtopicName: "",
      level: "",
      keyWellFormed: false,
    };
  }
  const classLevel = Number(parts[2]);
  return {
    board: parts[0] ?? "",
    subject: parts[1] ?? "",
    classLevel: Number.isFinite(classLevel) && [11, 12].includes(classLevel) ? classLevel : null,
    topic: parts[3] ?? "",
    subtopicName: parts[4] ?? "",
    level: parts[5] ?? "",
    keyWellFormed: true,
  };
}

function summarizeSnapshot(snapshot: SubtopicEngagementSnapshot): SubtopicInsightSummary {
  const bits = snapshot.bits;
  let bitsCurrentIdx: number | null = null;
  let bitsVisitedCount = 0;
  let bitsGraded: SubtopicInsightSummary["bitsGraded"] = null;
  if (bits === null) {
    bitsCurrentIdx = null;
  } else if (bits && typeof bits === "object") {
    bitsCurrentIdx = typeof bits.currentIdx === "number" ? bits.currentIdx : null;
    bitsVisitedCount = Array.isArray(bits.visitedIndices) ? bits.visitedIndices.length : 0;
    if (bits.graded && typeof bits.graded === "object") {
      const g = bits.graded;
      bitsGraded = {
        answered: g.answered,
        correct: g.correct,
        wrong: g.wrong,
        totalQuestions: g.totalQuestions,
      };
    }
  }

  const ic = snapshot.instaCue;
  const instaCueNavVisitedCount =
    ic && typeof ic === "object" && Array.isArray(ic.navVisited) ? ic.navVisited.length : 0;
  const instaCueFlippedCount =
    ic && typeof ic === "object" && Array.isArray(ic.flipped) ? ic.flipped.length : 0;

  const numeralsFormulaSlots =
    snapshot.formulaByIdx && typeof snapshot.formulaByIdx === "object"
      ? Object.keys(snapshot.formulaByIdx).length
      : 0;

  const conceptsPagesCount = Array.isArray(snapshot.conceptsPages)
    ? snapshot.conceptsPages.length
    : 0;

  return {
    lessonChecklistMarkedCompleteAt: snapshot.lessonChecklistMarkedCompleteAt ?? null,
    lessonFocusTimer: snapshot.lessonFocusTimer ?? null,
    bitsCurrentIdx,
    bitsVisitedCount,
    bitsGraded,
    instaCueNavVisitedCount,
    instaCueFlippedCount,
    numeralsFormulaSlots,
    conceptsPagesCount,
    updatedAt: snapshot.updatedAt,
  };
}

/** Flatten stored engagement JSON into admin-sortable rows (capped). */
export function buildSubtopicInsightRows(subtopicEngagement: Json | null | undefined): {
  rows: SubtopicInsightRow[];
  totalKeysInStore: number;
  capped: boolean;
} {
  const store = parseEngagementStore(subtopicEngagement);
  const entries = Object.entries(store);
  const totalKeysInStore = entries.length;
  entries.sort((a, b) => {
    const at = Date.parse(a[1].updatedAt);
    const bt = Date.parse(b[1].updatedAt);
    return (Number.isFinite(bt) ? bt : 0) - (Number.isFinite(at) ? at : 0);
  });
  const capped = entries.length > MAX_SUBTOPIC_INSIGHT_ROWS;
  const slice = entries.slice(0, MAX_SUBTOPIC_INSIGHT_ROWS);
  const rows: SubtopicInsightRow[] = slice.map(([storageKey, snapshot]) => {
    const scope = splitEngagementStorageKey(storageKey);
    return {
      storageKey,
      ...scope,
      summary: summarizeSnapshot(snapshot),
    };
  });
  return { rows, totalKeysInStore, capped };
}
