import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { GyanStudentPersona } from "@/lib/gyanBotPersonas";
import { GYAN_STUDENT_USER_IDS } from "@/lib/gyanBotPersonas";

export type GyanCurriculumNodeRow = Database["public"]["Tables"]["gyan_curriculum_nodes"]["Row"];

/** Nodes matching this persona’s subject pool (General/Other → full catalog). */
export function curriculumPoolForPersona(
  nodes: GyanCurriculumNodeRow[],
  persona: GyanStudentPersona
): GyanCurriculumNodeRow[] {
  const sf = persona.subjectFocus;
  if (sf === "General Question" || sf === "Other") {
    return [...nodes].sort((a, b) => a.sort_order - b.sort_order);
  }
  const slice = nodes.filter((n) => n.subject === sf);
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
