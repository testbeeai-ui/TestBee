import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json } from "@/integrations/supabase/types";
import { parseChapterQuizRefFromContentJson } from "@/lib/classroom/conceptFocusLessonCompletion";

export const TEACHER_SUBTOPIC_UNLOCK_RDM_CONFIG_KEY = "teacher_subtopic_unlock_rdm_per_student";
export const DEFAULT_SUBTOPIC_UNLOCK_RDM_PER_STUDENT = 10;

function isMissingUnlockTableError(err: { code?: string; message?: string } | null | undefined) {
  if (!err) return false;
  if (err.code === "42P01") return true;
  return (
    typeof err.message === "string" &&
    err.message.includes("classroom_subtopic_unlock_grants")
  );
}

export function subtopicUnlockTotal(perStudent: number, studentCount: number): number {
  const per = Math.max(0, Math.round(Number(perStudent) || 0));
  const n = Math.max(0, Math.floor(studentCount));
  if (per <= 0 || n <= 0) return 0;
  return per * n;
}

export async function fetchSubtopicUnlockRdmPerStudent(
  db: SupabaseClient
): Promise<number> {
  const { data, error } = await db
    .from("rdm_config")
    .select("value")
    .eq("key", TEACHER_SUBTOPIC_UNLOCK_RDM_CONFIG_KEY)
    .maybeSingle();
  if (error || data?.value == null) return DEFAULT_SUBTOPIC_UNLOCK_RDM_PER_STUDENT;
  const n = Math.round(Number(data.value));
  return Number.isFinite(n) && n > 0 ? Math.min(n, 500) : DEFAULT_SUBTOPIC_UNLOCK_RDM_PER_STUDENT;
}

export type CreateSubtopicUnlockGrantsResult = {
  unlockTotal: number;
  grantCount: number;
  amountPerStudent: number;
};

async function readPostContentJson(
  admin: SupabaseClient,
  postId: string
): Promise<Record<string, Json>> {
  const { data } = await admin.from("posts").select("content_json").eq("id", postId).maybeSingle();
  if (!data?.content_json || typeof data.content_json !== "object" || Array.isArray(data.content_json)) {
    return {};
  }
  return data.content_json as Record<string, Json>;
}

async function persistMcqSponsorshipMeta(
  admin: SupabaseClient,
  assignmentPostId: string,
  teacherId: string,
  meta: Record<string, Json>
): Promise<void> {
  const { error: metaErr } = await admin
    .from("posts")
    .update({
      content_json: {
        ...(await readPostContentJson(admin, assignmentPostId)),
        ...meta,
      },
    })
    .eq("id", assignmentPostId)
    .eq("teacher_id", teacherId);
  if (metaErr) throw new Error(metaErr.message);
}

/** Deduct teacher RDM for chapter-quiz bank-set sponsorship (no grant rows — assignment link unlocks the set). */
export async function chargeChapterQuizMcqSponsorship(
  admin: SupabaseClient,
  input: {
    teacherId: string;
    assignmentPostId: string;
    billableStudentIds: string[];
    amountPerStudent: number;
    premiumStudentCount: number;
  }
): Promise<CreateSubtopicUnlockGrantsResult> {
  const amountPerStudent = Math.max(0, Math.round(input.amountPerStudent));
  const studentIds = [...new Set(input.billableStudentIds.map((id) => id.trim()).filter(Boolean))];
  if (amountPerStudent <= 0 || studentIds.length === 0) {
    return { unlockTotal: 0, grantCount: 0, amountPerStudent: 0 };
  }

  const unlockTotal = amountPerStudent * studentIds.length;
  const { data: newRdm, error: deductErr } = await admin.rpc("deduct_rdm", {
    uid: input.teacherId,
    amt: unlockTotal,
  });
  if (deductErr) throw new Error(deductErr.message);
  if (newRdm === null) {
    throw new Error(
      `Insufficient RDM. MCQ unlock requires ${unlockTotal} RDM (${amountPerStudent} × ${studentIds.length} free students).`
    );
  }

  await persistMcqSponsorshipMeta(admin, input.assignmentPostId, input.teacherId, {
    mcqSponsorshipRdmPerStudent: amountPerStudent,
    mcqSponsorshipTotal: unlockTotal,
    mcqSponsorshipBillableStudentCount: studentIds.length,
    mcqSponsorshipPremiumStudentCount: Math.max(0, Math.floor(input.premiumStudentCount)),
  });

  return { unlockTotal, grantCount: 0, amountPerStudent };
}

/** Deduct teacher RDM and grant subtopic access rows (Concept Focus publish; free students only). */
export async function createSubtopicUnlockGrantsOnPublish(
  admin: SupabaseClient,
  input: {
    teacherId: string;
    assignmentPostId: string;
    contentJson: unknown;
    studentIds: string[];
    amountPerStudent?: number;
    premiumStudentCount?: number;
  }
): Promise<CreateSubtopicUnlockGrantsResult> {
  const amountPerStudent =
    input.amountPerStudent ?? (await fetchSubtopicUnlockRdmPerStudent(admin));
  const studentIds = [...new Set(input.studentIds.map((id) => id.trim()).filter(Boolean))];
  if (amountPerStudent <= 0 || studentIds.length === 0) {
    return { unlockTotal: 0, grantCount: 0, amountPerStudent: 0 };
  }

  const unlockTotal = amountPerStudent * studentIds.length;
  const chapterQuizRef = parseChapterQuizRefFromContentJson(input.contentJson);
  const chapterQuizJson = chapterQuizRef ? (chapterQuizRef as unknown as Json) : null;

  const { data: newRdm, error: deductErr } = await admin.rpc("deduct_rdm", {
    uid: input.teacherId,
    amt: unlockTotal,
  });
  if (deductErr) throw new Error(deductErr.message);
  if (newRdm === null) {
    throw new Error(
      `Insufficient RDM. Unlock requires ${unlockTotal} RDM (${amountPerStudent} × ${studentIds.length} free students).`
    );
  }

  const grantRows = studentIds.map((studentId) => ({
    assignment_post_id: input.assignmentPostId,
    teacher_id: input.teacherId,
    student_id: studentId,
    amount_rdm: amountPerStudent,
    status: "active" as const,
    chapter_quiz: chapterQuizJson,
  }));

  const { error: insErr } = await admin.from("classroom_subtopic_unlock_grants").insert(grantRows);
  if (insErr) {
    try {
      await admin.rpc("add_rdm", { uid: input.teacherId, amt: unlockTotal });
    } catch {
      /* best-effort */
    }
    throw new Error(insErr.message);
  }

  try {
    await persistMcqSponsorshipMeta(admin, input.assignmentPostId, input.teacherId, {
      subtopicUnlockRdmPerStudent: amountPerStudent,
      subtopicUnlockTotal: unlockTotal,
      subtopicUnlockStudentCount: studentIds.length,
      subtopicUnlockPremiumStudentCount: Math.max(0, Math.floor(input.premiumStudentCount ?? 0)),
    });
  } catch (metaErr) {
    await admin
      .from("classroom_subtopic_unlock_grants")
      .delete()
      .eq("assignment_post_id", input.assignmentPostId);
    try {
      await admin.rpc("add_rdm", { uid: input.teacherId, amt: unlockTotal });
    } catch {
      /* best-effort */
    }
    throw metaErr instanceof Error ? metaErr : new Error(String(metaErr));
  }

  return { unlockTotal, grantCount: studentIds.length, amountPerStudent };
}

/** Whether this student has teacher-sponsored access for a Concept Focus assignment. */
export async function hasActiveSubtopicUnlockGrant(
  db: SupabaseClient,
  studentId: string,
  assignmentPostId: string
): Promise<boolean> {
  const { data, error } = await db
    .from("classroom_subtopic_unlock_grants")
    .select("id")
    .eq("assignment_post_id", assignmentPostId)
    .eq("student_id", studentId)
    .eq("status", "active")
    .maybeSingle();
  if (error) {
    if (isMissingUnlockTableError(error)) return false;
    throw new Error(error.message);
  }
  return Boolean(data?.id);
}

export async function refundMcqSponsorshipChargeForPost(
  admin: SupabaseClient,
  assignmentPostId: string,
  teacherId: string
): Promise<number> {
  const content = await readPostContentJson(admin, assignmentPostId);
  const amount = Number(content.mcqSponsorshipTotal);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const { error } = await admin.rpc("add_rdm", { uid: teacherId, amt: amount });
  if (error) return 0;
  return amount;
}

export async function refundSubtopicUnlockGrantsForPost(
  admin: SupabaseClient,
  assignmentPostId: string,
  teacherId: string
): Promise<number> {
  const { data: rows, error } = await admin
    .from("classroom_subtopic_unlock_grants")
    .select("id, amount_rdm")
    .eq("assignment_post_id", assignmentPostId)
    .eq("teacher_id", teacherId)
    .eq("status", "active");
  if (error) {
    if (isMissingUnlockTableError(error)) return 0;
    throw new Error(error.message);
  }

  let refunded = 0;
  for (const row of rows ?? []) {
    const amount = Number(row.amount_rdm);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const { data: updated } = await admin
      .from("classroom_subtopic_unlock_grants")
      .update({ status: "refunded" })
      .eq("id", row.id)
      .eq("status", "active")
      .select("id")
      .maybeSingle();
    if (!updated?.id) continue;
    const { error: rpcErr } = await admin.rpc("add_rdm", { uid: teacherId, amt: amount });
    if (rpcErr) continue;
    refunded += amount;
  }
  return refunded;
}
