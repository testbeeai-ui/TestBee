import type { SupabaseClient } from "@supabase/supabase-js";
import { isStudentAssignmentCompleteForPayout } from "@/lib/teacherPortal/assignmentCompletionRdm";

/** Policy A: RDM bonus only when tied to an assignment students can complete. */
export function effectiveMotivationRdmDelta(
  rdmDelta: number,
  relatedPostId?: string | null
): number {
  const related = relatedPostId?.trim();
  if (!related) return 0;
  const n = Math.round(rdmDelta);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(n, 500);
}

const ASSIGNMENT_POST_TYPES = new Set([
  "assignment",
  "quiz",
  "mock",
  "past_paper",
  "Concept Focus",
]);

export async function assertRelatedAssignmentPost(
  db: SupabaseClient,
  classroomId: string,
  relatedPostId: string,
  teacherId: string
): Promise<{ id: string; type: string; content_json: unknown }> {
  const { data, error } = await db
    .from("posts")
    .select("id, type, content_json, classroom_id, teacher_id")
    .eq("id", relatedPostId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Linked assignment not found.");
  if (data.classroom_id !== classroomId) {
    throw new Error("Linked assignment does not belong to this classroom.");
  }
  if (data.teacher_id !== teacherId) {
    throw new Error("Linked assignment was not created by this teacher.");
  }
  if (!ASSIGNMENT_POST_TYPES.has(data.type)) {
    throw new Error("Linked post is not an assignment.");
  }
  return { id: data.id, type: data.type, content_json: data.content_json };
}

export async function tryFulfillAssignmentMotivationGrants(
  admin: SupabaseClient,
  studentId: string,
  assignmentPostId: string
): Promise<{ fulfilled: number; amounts: number[] }> {
  const { data: grants, error: gErr } = await admin
    .from("teacher_motivation_rdm_grants")
    .select("id, motivation_post_id, amount, status")
    .eq("student_id", studentId)
    .eq("assignment_post_id", assignmentPostId)
    .eq("status", "pending");
  if (gErr) {
    if (gErr.code === "42P01") return { fulfilled: 0, amounts: [] };
    throw new Error(gErr.message);
  }
  if (!grants?.length) return { fulfilled: 0, amounts: [] };

  const { data: post, error: pErr } = await admin
    .from("posts")
    .select("id, type, content_json")
    .eq("id", assignmentPostId)
    .maybeSingle();
  if (pErr || !post) return { fulfilled: 0, amounts: [] };

  const complete = await isStudentAssignmentCompleteForPayout(
    admin,
    assignmentPostId,
    post.type,
    post.content_json,
    studentId
  );
  if (!complete) return { fulfilled: 0, amounts: [] };

  const amounts: number[] = [];
  const paidAt = new Date().toISOString();
  for (const grant of grants) {
    const amount = Number(grant.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;

    const { data: claimed, error: claimErr } = await admin
      .from("teacher_motivation_rdm_grants")
      .update({ status: "paid", paid_at: paidAt })
      .eq("id", grant.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (claimErr || !claimed?.id) continue;

    const { error: rpcErr } = await admin.rpc("add_rdm", {
      uid: studentId,
      amt: amount,
    });
    if (rpcErr) {
      await admin
        .from("teacher_motivation_rdm_grants")
        .update({ status: "pending", paid_at: null })
        .eq("id", grant.id)
        .eq("status", "paid");
      continue;
    }

    amounts.push(amount);
  }

  return { fulfilled: amounts.length, amounts };
}
