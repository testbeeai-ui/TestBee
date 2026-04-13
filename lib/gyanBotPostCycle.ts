import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { getStudentPersonaByIndex, GYAN_STUDENT_PERSONAS } from "@/lib/gyanBotPersonas";
import { canonicalDoubtSubject } from "@/lib/doubtSubject";
import { loadCurriculumNodes, pickNextCurriculumNode } from "@/lib/gyanCurriculum";
import { generateStudentDoubtWithSarvam } from "@/lib/gyanStudentQuestion";
import { runProfPiAnswerForDoubt, type ProfPiAnswerResult } from "@/lib/gyanBotAnswer";

export type GyanBotCycleResult =
  | { ok: true; skipped: true; reason: string; nextEligibleAt?: string }
  | {
      ok: true;
      skipped: false;
      doubtId: string;
      studentIndex: number;
      nextIndex: number;
      answer: ProfPiAnswerResult;
    }
  | { ok: false; error: string };

/**
 * One full bot cycle: load config → optional interval gate → Sarvam student doubt → insert → ProfPi answer → bump index.
 */
export async function runGyanBotPostCycle(
  admin: SupabaseClient<Database>,
  options: { bypassInterval?: boolean } = {}
): Promise<GyanBotCycleResult> {
  const { data: cfg, error: cfgErr } = await admin.from("gyan_bot_config").select("*").eq("id", 1).maybeSingle();
  if (cfgErr || !cfg) {
    return { ok: false, error: cfgErr?.message ?? "Missing gyan_bot_config" };
  }

  if (!cfg.active) {
    return { ok: true, skipped: true, reason: "bot inactive" };
  }

  const intervalMs = Math.max(1, cfg.interval_minutes ?? 10) * 60_000;
  if (!options.bypassInterval && cfg.last_post_at) {
    const elapsed = Date.now() - new Date(cfg.last_post_at).getTime();
    if (elapsed < intervalMs) {
      return {
        ok: true,
        skipped: true,
        reason: "interval not elapsed",
        nextEligibleAt: new Date(new Date(cfg.last_post_at).getTime() + intervalMs).toISOString(),
      };
    }
  }

  const idx = cfg.current_student_index ?? 0;
  if (idx < 0 || idx >= GYAN_STUDENT_PERSONAS.length) {
    return { ok: false, error: "Invalid current_student_index" };
  }

  const persona = getStudentPersonaByIndex(idx);

  const curriculumNodes = await loadCurriculumNodes(admin);
  const seq = cfg.curriculum_sequence_index ?? 0;
  const batchSlot = cfg.curriculum_batch_slot ?? 1;
  const curriculumPick =
    curriculumNodes.length > 0
      ? await pickNextCurriculumNode({
          admin,
          allNodes: curriculumNodes,
          persona,
          curriculumSequenceIndex: seq,
          curriculumBatchSlot: batchSlot,
        })
      : null;

  const generated = await generateStudentDoubtWithSarvam(persona, {
    rotationIndex: idx,
    curriculum:
      curriculumPick != null
        ? {
            node: curriculumPick.node,
            batchSlot,
            requiresNumeric: curriculumPick.requiresNumeric,
          }
        : undefined,
  });
  if (!generated) {
    return { ok: false, error: "Failed to generate doubt (Sarvam — check SARVAM_API_KEY and logs)" };
  }

  const subjectStored =
    canonicalDoubtSubject(generated.subject) ?? persona.subjectFocus;

  const { data: doubtRow, error: insDoubtErr } = await admin
    .from("doubts")
    .insert({
      user_id: persona.userId,
      title: generated.title,
      body: generated.body,
      subject: subjectStored,
      gyan_curriculum_node_id: curriculumPick?.node.id ?? null,
      cost_rdm: 0,
      bounty_rdm: 0,
      bounty_escrowed_at: null,
      upvotes: 0,
      downvotes: 0,
      is_resolved: false,
      views: 0,
    })
    .select("id")
    .single();

  if (insDoubtErr || !doubtRow?.id) {
    return { ok: false, error: insDoubtErr?.message ?? "Insert doubt failed" };
  }

  const answer = await runProfPiAnswerForDoubt(admin, doubtRow.id, { gradeLevel: persona.classLevel });
  if (!answer.ok) {
    return { ok: false, error: answer.error };
  }

  const nextIndex = (idx + 1) % GYAN_STUDENT_PERSONAS.length;
  const configPatch: Record<string, unknown> = {
    current_student_index: nextIndex,
    last_post_at: new Date().toISOString(),
  };
  if (curriculumPick != null) {
    configPatch.curriculum_sequence_index = curriculumPick.nextSequenceIndex;
    configPatch.curriculum_batch_slot = curriculumPick.nextBatchSlot;
  }
  await admin.from("gyan_bot_config").update(configPatch).eq("id", 1);

  return {
    ok: true,
    skipped: false,
    doubtId: doubtRow.id,
    studentIndex: idx,
    nextIndex,
    answer,
  };
}
