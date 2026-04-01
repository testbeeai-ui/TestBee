/**
 * Deterministic checks for subtopic_content completeness and topic_content prerequisite gate.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export const SUBTOPIC_DIFFICULTY_LEVELS = ["basics", "intermediate", "advanced"] as const;
export type SubtopicDifficultyLevel = (typeof SUBTOPIC_DIFFICULTY_LEVELS)[number];

export type TopicHubScope = "topic" | "chapter";

/** Minimum counts to consider InstaCue / Bits "present" (avoid unnecessary regen). */
export const MIN_INSTACUE_CARDS = 1;
export const MIN_BITS_QUESTIONS = 1;

export function subtopicTheoryIsPlaceholder(theory: string): boolean {
  return (
    theory.includes("Study your textbook and notes") || theory.includes("Key ideas will appear")
  );
}

/** Heuristic: theory likely contains extractable formulas (skip formula gen if false and formulas empty). */
export function theoryMayContainFormulas(theory: string): boolean {
  const t = String(theory ?? "");
  if (/\^[_^{]|\\frac|\\cdot|\\times|\\sqrt|=.*[=]|\\text\{/.test(t)) return true;
  if (/[α-ωΑ-Ω∑∫]/.test(t)) return true;
  return /\b(m\/s|kg|N\s|J\s|W\s|Pa\s|mol\b)\b/i.test(t);
}

export type SubtopicRowShape = {
  theory?: string | null;
  instacue_cards?: unknown;
  bits_questions?: unknown;
  practice_formulas?: unknown;
};

export type SubtopicAssessment = {
  theoryMissingOrPlaceholder: boolean;
  instacueGap: boolean;
  bitsGap: boolean;
  formulasGap: boolean;
  skipFormulasConceptual: boolean;
};

export function assessSubtopicRow(row: SubtopicRowShape | null | undefined): SubtopicAssessment {
  const theory = String(row?.theory ?? "").trim();
  const instacue = Array.isArray(row?.instacue_cards) ? row!.instacue_cards : [];
  const bits = Array.isArray(row?.bits_questions) ? row!.bits_questions : [];
  const formulas = Array.isArray(row?.practice_formulas) ? row!.practice_formulas : [];

  const theoryMissingOrPlaceholder =
    !theory || subtopicTheoryIsPlaceholder(theory);
  const instacueGap = instacue.length < MIN_INSTACUE_CARDS;
  const bitsGap = bits.length < MIN_BITS_QUESTIONS;

  const skipFormulasConceptual =
    formulas.length === 0 &&
    !(bits.length > 0 || theoryMayContainFormulas(theory));

  const formulasGap =
    formulas.length === 0 && !skipFormulasConceptual;

  return {
    theoryMissingOrPlaceholder,
    instacueGap,
    bitsGap,
    formulasGap,
    skipFormulasConceptual,
  };
}

export type TopicContentGateRow = {
  why_study?: string | null;
  what_learn?: string | null;
  real_world?: string | null;
  subtopic_previews?: unknown;
};

export function isTopicContentRowViable(row: TopicContentGateRow | null | undefined): boolean {
  if (!row) return false;
  const w = (s?: string | null) => String(s ?? "").trim().length > 0;
  if (w(row.why_study) || w(row.what_learn) || w(row.real_world)) return true;
  return Array.isArray(row.subtopic_previews) && row.subtopic_previews.length > 0;
}

export type TopicHubGateResult =
  | { ok: true; viableByLevel: Record<SubtopicDifficultyLevel, boolean> }
  | {
      ok: false;
      missingTopicLevels: SubtopicDifficultyLevel[];
      viableByLevel: Record<SubtopicDifficultyLevel, boolean>;
    };

function buildTopicHubGateFromRows(
  byLevel: Partial<Record<string, TopicContentGateRow | undefined>>
): TopicHubGateResult {
  const viableByLevel = {} as Record<SubtopicDifficultyLevel, boolean>;
  const missing: SubtopicDifficultyLevel[] = [];

  for (const level of SUBTOPIC_DIFFICULTY_LEVELS) {
    const viable = isTopicContentRowViable(byLevel[level] ?? null);
    viableByLevel[level] = viable;
    if (!viable) missing.push(level);
  }

  if (missing.length > 0) {
    return { ok: false, missingTopicLevels: missing, viableByLevel };
  }
  return { ok: true, viableByLevel };
}

export async function fetchTopicHubGateWithRows(
  supabase: SupabaseClient,
  params: {
    board: string;
    subject: string;
    classLevel: number;
    topic: string;
    hubScope: TopicHubScope;
  }
): Promise<{
  gate: TopicHubGateResult;
  rowsByLevel: Partial<Record<SubtopicDifficultyLevel, TopicContentGateRow>>;
}> {
  const { data, error } = await supabase
    .from("topic_content")
    .select("level, why_study, what_learn, real_world, subtopic_previews")
    .eq("board", params.board)
    .eq("subject", params.subject)
    .eq("class_level", params.classLevel)
    .eq("topic", params.topic)
    .eq("hub_scope", params.hubScope);

  if (error) {
    console.warn("[topicHubGate] topic_content select error", error.message);
  }

  const byLevel: Partial<Record<string, TopicContentGateRow>> = {};
  for (const row of data ?? []) {
    const lv = String((row as { level?: string }).level ?? "").trim().toLowerCase();
    if (lv) {
      byLevel[lv] = row as TopicContentGateRow;
    }
  }

  const rowsByLevel: Partial<Record<SubtopicDifficultyLevel, TopicContentGateRow>> = {};
  for (const level of SUBTOPIC_DIFFICULTY_LEVELS) {
    const r = byLevel[level];
    if (r) rowsByLevel[level] = r;
  }

  return { gate: buildTopicHubGateFromRows(byLevel), rowsByLevel };
}

/** @deprecated prefer fetchTopicHubGateWithRows when preview text is needed */
export async function fetchTopicHubGateResult(
  supabase: SupabaseClient,
  params: Parameters<typeof fetchTopicHubGateWithRows>[1]
): Promise<TopicHubGateResult> {
  const { gate } = await fetchTopicHubGateWithRows(supabase, params);
  return gate;
}

function normalizeLooseSubtopicKey(value: string): string {
  return value.trim().toLowerCase();
}

/** Match preview from topic hub `subtopic_previews` for generate-subtopic seeding. */
export function extractSubtopicPreviewFromTopicRow(
  row: TopicContentGateRow | null | undefined,
  subtopicName: string
): string {
  const raw = row?.subtopic_previews;
  if (!Array.isArray(raw)) return "";
  const target = normalizeLooseSubtopicKey(subtopicName);
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const name = String(o.subtopic_name ?? o.subtopicName ?? "").trim();
    if (normalizeLooseSubtopicKey(name) === target && typeof o.preview === "string") {
      return o.preview.slice(0, 4000);
    }
  }
  return "";
}
