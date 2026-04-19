import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { ReferChallengePublicSpec } from "@/lib/referEarnChallenges";
import { fetchPlayQuestionsAdaptiveWithFallback } from "@/lib/fetchPlayQuestionsAdaptiveWithFallback";
import { fetchPlayQuestionsDomainRandom } from "@/lib/fetchPlayQuestionsDomainRandom";
import type { PlayDomain, PlayQuestionRow } from "@/types";

/**
 * Refer & Earn inline challenges — fixed pools (do not rely on spec.playCategory alone):
 * - MentaMill (5 RDM): **mental_math only** (same domain as Funbrain, single category).
 * - FunBrain Quiz (10 RDM): **entire funbrain domain** (verbal, quant, analytical, puzzles, GK, mental math, …)
 *   via `funbrain_all` adaptive pool (separate cycle key from Daily Gauntlet’s `funbrain_gauntlet`).
 * - Academic cards: `academic_all` (same mastery cycle as /play Streak Survival — correct answers excluded until pool reset; wrong can repeat).
 *
 * When `get_adaptive_play_questions` returns no rows (RPC error, migration drift, or an edge-case empty eligible set),
 * domain-wide challenges fall back to the same stratified random bank as admin streak (`fetchPlayQuestionsDomainRandom`)
 * so the refer UI never dead-ends on “Couldn’t load questions”.
 */
const DOMAIN_WIDE_SENTINELS = new Set<string>([
  "academic_all",
  "academic_gauntlet",
  "funbrain_all",
  "funbrain_gauntlet",
]);

type PqRow = {
  id: string;
  content: unknown;
  options: unknown;
  correct_answer_index: number;
  explanation: string | null;
  difficulty_rating: number;
  category: string;
};

function shuffleCopy<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]!;
    a[i] = a[j]!;
    a[j] = t;
  }
  return a;
}

function toPlayQuestionRow(r: PqRow): PlayQuestionRow {
  return {
    id: r.id,
    content: r.content as PlayQuestionRow["content"],
    options: r.options as unknown as string[],
    correct_answer_index: r.correct_answer_index,
    explanation: r.explanation,
    difficulty_rating: r.difficulty_rating,
    category: r.category,
  };
}

async function fetchReferQuestionsWithStratifiedFallback(
  sb: SupabaseClient<Database>,
  domain: PlayDomain,
  category: string,
  count: number,
): Promise<PlayQuestionRow[]> {
  const adaptive = await fetchPlayQuestionsAdaptiveWithFallback(sb, { domain, category, count });
  if (adaptive.length > 0) return adaptive;

  if (DOMAIN_WIDE_SENTINELS.has(category) && (domain === "academic" || domain === "funbrain")) {
    return fetchPlayQuestionsDomainRandom(sb, { domain, count });
  }

  if (domain === "funbrain" && category === "mental_math") {
    const { data, error } = await sb
      .from("play_questions")
      .select("id, content, options, correct_answer_index, explanation, difficulty_rating, category")
      .eq("domain", "funbrain")
      .eq("category", "mental_math")
      .limit(Math.max(count * 4, 24));
    if (error || !data?.length) return [];
    return shuffleCopy(data as PqRow[])
      .slice(0, count)
      .map(toPlayQuestionRow);
  }

  return [];
}

export async function fetchReferChallengeQuestions(
  sb: SupabaseClient<Database>,
  spec: ReferChallengePublicSpec,
): Promise<PlayQuestionRow[]> {
  if (spec.key === "5") {
    return fetchReferQuestionsWithStratifiedFallback(sb, "funbrain", "mental_math", spec.questionCount);
  }
  if (spec.key === "10") {
    return fetchReferQuestionsWithStratifiedFallback(sb, "funbrain", "funbrain_all", spec.questionCount);
  }
  return fetchReferQuestionsWithStratifiedFallback(sb, spec.domain as PlayDomain, spec.playCategory, spec.questionCount);
}
