import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { GyanStudentPersona } from "@/lib/gyanBotPersonas";
import { GYAN_STUDENT_USER_IDS } from "@/lib/gyanBotPersonas";

export type GyanCurriculumNodeRow = Database["public"]["Tables"]["gyan_curriculum_nodes"]["Row"];

/** Map doubt subject flair to `gyan_curriculum_nodes.subject` (title case). */
export function flairToCurriculumSubject(flair: string | null): string | null {
  const s = (flair ?? "").toLowerCase();
  if (s.includes("chem")) return "Chemistry";
  if (s.includes("math")) return "Math";
  if (s.includes("phys")) return "Physics";
  return null;
}

const MATCH_STOPWORDS = new Set([
  "the", "and", "for", "are", "but", "not", "you", "all", "can", "her", "was", "one", "our", "out", "day",
  "get", "has", "him", "his", "how", "its", "may", "new", "now", "old", "see", "two", "who", "way", "use", "any",
  "why", "this", "that", "with", "from", "they", "have", "been", "into", "more", "than", "when", "what", "will",
  "your", "about", "which", "their", "does", "did", "some", "such", "here", "just", "like", "also", "then", "them",
]);

function stripHtmlLite(html: string): string {
  return html.replace(/<[^>]*>/g, " ");
}

function tokenizeForMatch(text: string): string[] {
  return stripHtmlLite(text)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !MATCH_STOPWORDS.has(w));
}

/**
 * Pick the curriculum cell whose labels + RAG hint overlap most with the doubt text.
 * Used to link student threads to a chapter/topic after Prof-Pi answers (feed shows Ch/Tp/Sub).
 */
export function bestMatchingCurriculumNode(
  nodes: GyanCurriculumNodeRow[],
  curriculumSubject: string,
  titleHtml: string,
  bodyHtml: string
): GyanCurriculumNodeRow | null {
  const pool = nodes.filter((n) => n.subject === curriculumSubject);
  if (pool.length === 0) return null;
  const tokens = tokenizeForMatch(`${titleHtml}\n${bodyHtml}`);
  if (tokens.length === 0) return null;
  const tokenSet = new Set(tokens);
  let best: { node: GyanCurriculumNodeRow; score: number } | null = null;
  for (const node of pool) {
    const blob = [node.chapter_label, node.topic_label, node.subtopic_label, node.rag_query_hint]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    let score = 0;
    for (const t of tokenSet) {
      if (blob.includes(t)) score += 1;
    }
    if (score > (best?.score ?? 0)) best = { node, score };
  }
  const MIN_SCORE = 3;
  if (!best || best.score < MIN_SCORE) return null;
  return best.node;
}

/**
 * If the doubt has no curriculum FK yet, set it from title/body overlap with seeded nodes.
 */
export async function maybeAttachCurriculumNodeToDoubt(params: {
  admin: SupabaseClient<Database>;
  doubtId: string;
  subjectFlair: string | null;
  titleHtml: string;
  bodyHtml: string | null;
  existingNodeId: string | null;
}): Promise<void> {
  if (params.existingNodeId) return;
  const subj = flairToCurriculumSubject(params.subjectFlair);
  if (!subj) return;
  const nodes = await loadCurriculumNodes(params.admin);
  const match = bestMatchingCurriculumNode(nodes, subj, params.titleHtml, params.bodyHtml ?? "");
  if (!match) return;
  const { error } = await params.admin
    .from("doubts")
    .update({ gyan_curriculum_node_id: match.id })
    .eq("id", params.doubtId);
  if (error) {
    console.warn("[gyanCurriculum] attach node to doubt", error.message);
  }
}

/** Nodes matching this persona’s PCM subject (`gyan_curriculum_nodes.subject`). */
export function curriculumPoolForPersona(
  nodes: GyanCurriculumNodeRow[],
  persona: GyanStudentPersona
): GyanCurriculumNodeRow[] {
  const slice = nodes.filter((n) => n.subject === persona.subjectFocus);
  if (slice.length === 0) {
    return [...nodes].sort((a, b) => a.sort_order - b.sort_order);
  }
  return slice.sort((a, b) => a.sort_order - b.sort_order);
}

/** True if any Gyan student bot user already posted a doubt for this curriculum cell. */
export async function botAlreadyPostedCurriculumNode(
  admin: SupabaseClient<Database>,
  nodeId: string
): Promise<boolean> {
  const { data, error } = await admin
    .from("doubts")
    .select("id")
    .eq("gyan_curriculum_node_id", nodeId)
    .in("user_id", [...GYAN_STUDENT_USER_IDS])
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn("[gyanCurriculum] dedupe check", error.message);
    return false;
  }
  return !!data;
}

export async function loadCurriculumNodes(
  admin: SupabaseClient<Database>
): Promise<GyanCurriculumNodeRow[]> {
  const { data, error } = await admin
    .from("gyan_curriculum_nodes")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) {
    console.error("[gyanCurriculum] load nodes", error.message);
    return [];
  }
  return (data as GyanCurriculumNodeRow[]) ?? [];
}

export type CurriculumPickResult = {
  node: GyanCurriculumNodeRow;
  requiresNumeric: boolean;
  nextSequenceIndex: number;
  nextBatchSlot: number;
};

/**
 * Picks the next curriculum cell for this persona, skipping cells already used by any student bot.
 * If every cell in the pool is used, repeats the starting cell (coverage over strict dedupe).
 */
export async function pickNextCurriculumNode(params: {
  admin: SupabaseClient<Database>;
  allNodes: GyanCurriculumNodeRow[];
  persona: GyanStudentPersona;
  curriculumSequenceIndex: number;
  curriculumBatchSlot: number;
}): Promise<CurriculumPickResult | null> {
  const pool = curriculumPoolForPersona(params.allNodes, params.persona);
  if (pool.length === 0) return null;

  const start = Math.abs(params.curriculumSequenceIndex) % pool.length;
  const requiresNumeric = params.curriculumBatchSlot === 5;
  const nextBatchSlot = params.curriculumBatchSlot === 5 ? 1 : params.curriculumBatchSlot + 1;
  const nextSequenceIndex = params.curriculumSequenceIndex + 1;

  for (let k = 0; k < pool.length; k++) {
    const i = (start + k) % pool.length;
    const node = pool[i]!;
    const dup = await botAlreadyPostedCurriculumNode(params.admin, node.id);
    if (!dup) {
      return { node, requiresNumeric, nextSequenceIndex, nextBatchSlot };
    }
  }

  const node = pool[start]!;
  return { node, requiresNumeric, nextSequenceIndex, nextBatchSlot };
}
