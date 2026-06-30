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

/** Direct teacher→student credit (recognition / top students) — not gated on assignment completion. */
export function normalizeInstantMotivationRdm(raw: number): number {
  const n = Math.round(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(n, 500);
}

export async function payInstantMotivationRdmToStudents(
  admin: SupabaseClient,
  teacherId: string,
  studentIds: string[],
  amountPerStudent: number
): Promise<{ charged: number; paidTotal: number; studentCount: number }> {
  const per = normalizeInstantMotivationRdm(amountPerStudent);
  const targets = [...new Set(studentIds.map((id) => id.trim()).filter(Boolean))];
  if (per <= 0 || targets.length === 0) {
    return { charged: 0, paidTotal: 0, studentCount: 0 };
  }

  const totalCharge = per * targets.length;
  const { data: newRdm, error: deductErr } = await admin.rpc("deduct_rdm", {
    uid: teacherId,
    amt: totalCharge,
  });
  if (deductErr) throw new Error(deductErr.message);
  if (newRdm === null) {
    throw new Error(
      `Insufficient RDM. This reward requires ${totalCharge} RDM (${per} × ${targets.length} students).`
    );
  }

  let paidTotal = 0;
  let paidCount = 0;
  for (const studentId of targets) {
    const { error: rpcErr } = await admin.rpc("add_rdm", { uid: studentId, amt: per });
    if (rpcErr) continue;
    paidTotal += per;
    paidCount += 1;
  }

  if (paidCount < targets.length) {
    const refund = (targets.length - paidCount) * per;
    if (refund > 0) {
      try {
        await admin.rpc("add_rdm", { uid: teacherId, amt: refund });
      } catch {
        /* best-effort */
      }
    }
  }

  return { charged: paidCount * per, paidTotal, studentCount: paidCount };
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

/** Retry pending motivation bonuses when a student opens an assignment (mirrors completion reward sync). */
export async function syncStudentMotivationGrantsForAssignment(
  admin: SupabaseClient,
  studentId: string,
  assignmentPostId: string
): Promise<{ fulfilled: number; paidTotal: number }> {
  const { fulfilled, amounts } = await tryFulfillAssignmentMotivationGrants(
    admin,
    studentId,
    assignmentPostId
  );
  return { fulfilled, paidTotal: amounts.reduce((sum, n) => sum + n, 0) };
}
