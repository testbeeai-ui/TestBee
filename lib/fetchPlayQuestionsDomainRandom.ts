import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { PlayDomain, PlayQuestionRow } from "@/types";

function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = t;
  }
}

/** DB rows for one `play_questions` row (Json columns). */
type RawPlayQuestion = {
  id: string;
  content: unknown;
  options: unknown;
  correct_answer_index: number;
  explanation: string | null;
  difficulty_rating: number;
  category: string;
};

function toPlayQuestionRow(r: RawPlayQuestion): PlayQuestionRow {
  return {
    id: r.id,
    content: r.content as unknown as PlayQuestionRow["content"],
    options: r.options as unknown as string[],
    correct_answer_index: r.correct_answer_index,
    explanation: r.explanation,
    difficulty_rating: r.difficulty_rating,
    category: r.category,
  };
}

/** Mirrors `get_adaptive_play_questions` domain-wide: Hamilton quotas per category, then shuffle. */
const FUNBRAIN_DOMAIN_CATEGORIES = [
  "puzzles",
  "verbal",
  "quantitative",
  "analytical",
  "gk",
  "mental_math",
] as const;

const ACADEMIC_DOMAIN_CATEGORIES = ["physics", "chemistry", "math"] as const;

function domainCategorySentinels(domain: PlayDomain): readonly string[] {
  return domain === "funbrain" ? FUNBRAIN_DOMAIN_CATEGORIES : ACADEMIC_DOMAIN_CATEGORIES;
}

/**
 * Streak / QA for app admins: full domain bank, no `play_history` exclusion.
 * Stratified by `category` (same idea as `get_adaptive_play_questions`) so one topic
 * does not dominate a session — a plain `limit` + shuffle was biased by table order.
 */
export async function fetchPlayQuestionsDomainRandom(
  sb: SupabaseClient<Database>,
  params: { domain: PlayDomain; count: number },
): Promise<PlayQuestionRow[]> {
  const { domain, count } = params;
  const sentinels = domainCategorySentinels(domain);
  const perCatLimit = Math.min(400, Math.max(count * 4, 24));

  const batch = await Promise.all(
    sentinels.map((category) =>
      sb
        .from("play_questions")
        .select("id, content, options, correct_answer_index, explanation, difficulty_rating, category")
        .eq("domain", domain)
        .eq("category", category)
        .limit(perCatLimit),
    ),
  );

  const byCat = new Map<string, RawPlayQuestion[]>();
  for (let i = 0; i < sentinels.length; i++) {
    const cat = sentinels[i]!;
    const rows = batch[i]?.data;
    if (rows?.length) {
      const shuffled = rows as RawPlayQuestion[];
      shuffleInPlace(shuffled);
      byCat.set(cat, shuffled);
    }
  }

  const catList = [...byCat.keys()];
  if (catList.length === 0) return [];

  const c = catList.length;
  const floorPart = Math.floor(count / c);
  const rem = count % c;

  const orderedCats = [...catList];
  shuffleInPlace(orderedCats);
  const quota = new Map<string, number>();
  for (let i = 0; i < orderedCats.length; i++) {
    const cat = orderedCats[i]!;
    quota.set(cat, floorPart + (i < rem ? 1 : 0));
  }

  const firstIds = new Set<string>();
  const firstPick: RawPlayQuestion[] = [];
  for (const cat of catList) {
    const q = quota.get(cat) ?? 0;
    const pool = byCat.get(cat) ?? [];
    const take = Math.min(q, pool.length);
    for (let j = 0; j < take; j++) {
      const row = pool[j]!;
      firstPick.push(row);
      firstIds.add(row.id);
    }
  }

  const deficit = Math.max(0, count - firstPick.length);
  const rest: RawPlayQuestion[] = [];
  for (const [, pool] of byCat) {
    for (const row of pool) {
      if (!firstIds.has(row.id)) rest.push(row);
    }
  }
  shuffleInPlace(rest);
  const secondPick = rest.slice(0, deficit);

  const combined = [...firstPick, ...secondPick];
  shuffleInPlace(combined);
  return combined.slice(0, count).map(toPlayQuestionRow);
}
