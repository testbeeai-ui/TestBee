/**
 * Lookup Learning Outcomes MCQ packs. Exact key first, then legacy sanitize,
 * then a loose collision match (same as subtopic_content GET).
 */

export type LearningOutcomesLookupKey = {
  board: string;
  subject: string;
  class_level: number;
  topic: string;
  subtopic_name: string;
  level: string;
};

type LoRow = {
  topic?: unknown;
  subtopic_name?: unknown;
  questions?: unknown;
};

type LoFilter = {
  eq: (column: string, value: string | number) => LoFilter;
  maybeSingle: () => Promise<{ data: { questions?: unknown } | null }>;
  limit: (n: number) => Promise<{ data: LoRow[] | null; error: { message: string } | null }>;
};

export type LearningOutcomesClient = {
  from: (table: string) => { select: (columns: string) => LoFilter };
};

export function legacySanitizeForLookup(value: string): string {
  return value
    .replace(/[<>\x00-\x1F\x7F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function looseCollisionKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function asQuestionsArray(raw: unknown): unknown[] {
  return Array.isArray(raw) && raw.length > 0 ? raw : [];
}

export function pickLoCollisionMatch<T extends LoRow>(
  rows: T[],
  topic: string,
  subtopicName: string
): T | undefined {
  const targetTopic = looseCollisionKey(topic);
  const targetSubtopic = looseCollisionKey(subtopicName);
  if (!targetTopic || !targetSubtopic) return undefined;
  return rows.find((row) => {
    const rowTopic = looseCollisionKey(String(row.topic ?? ""));
    const rowSub = looseCollisionKey(String(row.subtopic_name ?? ""));
    return rowTopic === targetTopic && rowSub === targetSubtopic;
  });
}

function loQuestionsQuery(supabase: LearningOutcomesClient): LoFilter {
  return supabase.from("learning_outcomes_questions").select("questions");
}

export async function fetchLearningOutcomesQuestions(
  supabase: unknown,
  lookup: LearningOutcomesLookupKey
): Promise<unknown[]> {
  const client = supabase as LearningOutcomesClient;
  const exact = await loQuestionsQuery(client)
    .eq("board", lookup.board)
    .eq("subject", lookup.subject)
    .eq("class_level", lookup.class_level)
    .eq("topic", lookup.topic)
    .eq("subtopic_name", lookup.subtopic_name)
    .eq("level", lookup.level)
    .maybeSingle();

  const exactQs = asQuestionsArray(exact.data?.questions);
  if (exactQs.length > 0) return exactQs;

  const legacyTopic = legacySanitizeForLookup(lookup.topic);
  const legacySubtopic = legacySanitizeForLookup(lookup.subtopic_name);
  if (legacyTopic !== lookup.topic || legacySubtopic !== lookup.subtopic_name) {
    const legacy = await loQuestionsQuery(client)
      .eq("board", lookup.board)
      .eq("subject", lookup.subject)
      .eq("class_level", lookup.class_level)
      .eq("topic", legacyTopic)
      .eq("subtopic_name", legacySubtopic)
      .eq("level", lookup.level)
      .maybeSingle();
    const legacyQs = asQuestionsArray(legacy.data?.questions);
    if (legacyQs.length > 0) return legacyQs;
  }

  const candidates = await client
    .from("learning_outcomes_questions")
    .select("topic, subtopic_name, questions")
    .eq("board", lookup.board)
    .eq("subject", lookup.subject)
    .eq("class_level", lookup.class_level)
    .eq("level", lookup.level)
    .limit(400);

  if (candidates.error || !Array.isArray(candidates.data)) return [];
  const match = pickLoCollisionMatch(candidates.data, lookup.topic, lookup.subtopic_name);
  return asQuestionsArray(match?.questions);
}
