import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json } from "@/integrations/supabase/types";
import {
  parseChapterQuizRefFromContentJson,
  chapterQuizMatchesLessonMark,
  type StudentLessonMarkCompletionRow,
} from "@/lib/classroom/conceptFocusLessonCompletion";
import { isStudentAssignmentComplete } from "@/lib/classroom/assignmentStudentCompletion";
import { parseBitsTestAttemptsStore } from "@/lib/play/bits/parseBitsTestAttemptsStore";

export const ASSIGNMENT_COMPLETION_REWARD_OPTIONS = [0, 15, 25, 40, 50] as const;
export const MAX_ASSIGNMENT_COMPLETION_REWARD_RDM = 500;

export type AssignmentCompletionGrantStatus = "pending" | "paid" | "refunded" | "cancelled";

export function normalizeCompletionRewardRdm(raw: unknown): number {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(n, MAX_ASSIGNMENT_COMPLETION_REWARD_RDM);
}

export function completionEscrowTotal(rewardRdm: number, studentCount: number): number {
  const per = normalizeCompletionRewardRdm(rewardRdm);
  const n = Math.max(0, Math.floor(studentCount));
  if (per <= 0 || n <= 0) return 0;
  return per * n;
}

export function parseCompletionRewardFromContentJson(contentJson: unknown): number {
  if (!contentJson || typeof contentJson !== "object" || Array.isArray(contentJson)) return 0;
  const o = contentJson as Record<string, unknown>;
  const fromEscrow = o.completionRewardRdm;
  if (typeof fromEscrow === "number" && Number.isFinite(fromEscrow)) {
    return normalizeCompletionRewardRdm(fromEscrow);
  }
  return normalizeCompletionRewardRdm(o.rewardRdm);
}

function isMissingGrantsTableError(err: { code?: string; message?: string } | null | undefined) {
  if (!err) return false;
  if (err.code === "42P01") return true;
  return (
    typeof err.message === "string" &&
    err.message.includes("classroom_assignment_completion_rdm_grants")
  );
}

/** Resolve student user ids for an assignment audience at publish time. */
export async function resolveAssignmentTargetStudentIds(
  db: SupabaseClient,
  input: {
    classroomId: string;
    sectionId?: string | null;
    targetStudentIds?: string[] | null;
  }
): Promise<string[]> {
  const { data: members, error } = await db
    .from("classroom_members")
    .select("user_id, role, section_id")
    .eq("classroom_id", input.classroomId);
  if (error) throw new Error(error.message);

  const sectionId =
    typeof input.sectionId === "string" && input.sectionId.trim()
      ? input.sectionId.trim()
      : null;

  let studentIds = (members ?? [])
    .filter((m) => String((m as { role?: unknown }).role ?? "").toLowerCase() === "student")
    .filter((m) => {
      if (!sectionId) return true;
      return String((m as { section_id?: unknown }).section_id ?? "") === sectionId;
    })
    .map((m) => String((m as { user_id: string }).user_id));

  const targets = input.targetStudentIds?.filter((id) => typeof id === "string" && id.trim()) ?? [];
  if (targets.length > 0) {
    const targetSet = new Set(targets.map((id) => id.trim()));
    studentIds = studentIds.filter((id) => targetSet.has(id));
  }

  return [...new Set(studentIds)].sort((a, b) => a.localeCompare(b));
}

async function fetchSubmittedAttemptPostIds(
  db: SupabaseClient,
  studentId: string,
  postIds: string[]
): Promise<Set<string>> {
  if (postIds.length === 0) return new Set();
  const genericClient = db as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (
          col: string,
          val: string
        ) => {
          in: (
            col: string,
            vals: string[]
          ) => {
            not: (
              col: string,
              op: string,
              val: null
            ) => Promise<{
              data: Array<{ post_id: string }> | null;
              error: { message?: string } | null;
            }>;
          };
        };
      };
    };
  };
  const { data, error } = await genericClient
    .from("classroom_generated_test_attempts")
    .select("post_id")
    .eq("user_id", studentId)
    .in("post_id", postIds)
    .not("submitted_at", "is", null);
  if (error) return new Set();
  return new Set((data ?? []).map((r) => r.post_id));
}

function normalizeLookupKey(v: unknown): string {
  return String(v ?? "")
    .trim()
    .toLowerCase();
}

function studentHasChapterQuizBitsAttempt(
  bitsRows: ReturnType<typeof parseBitsTestAttemptsStore>,
  contentJson: unknown
): boolean {
  const ref = parseChapterQuizRefFromContentJson(contentJson);
  if (!ref) return false;
  return bitsRows.some((r) => {
    return (
      normalizeLookupKey(r.subject) === ref.subject &&
      Number(r.classLevel) === ref.classLevel &&
      normalizeLookupKey(r.topic) === normalizeLookupKey(ref.topic) &&
      normalizeLookupKey(r.subtopicName) === normalizeLookupKey(ref.subtopicName) &&
      normalizeLookupKey(r.level) === ref.level
    );
  });
}

async function loadStudentLessonMarksForUser(
  db: SupabaseClient,
  studentId: string
): Promise<StudentLessonMarkCompletionRow[]> {
  const { data, error } = await db
    .from("student_lesson_mark_completions" as never)
    .select("board, subject, class_level, topic, subtopic, level, marked_complete_at")
    .eq("user_id", studentId);
  if (error) {
    if (error.code === "42P01") return [];
    throw new Error(error.message);
  }
  return (data ?? []) as StudentLessonMarkCompletionRow[];
}

async function loadStudentAssignmentCompletionContext(
  db: SupabaseClient,
  assignmentPostId: string,
  postType: string,
  contentJson: unknown,
  studentId: string
): Promise<{
  completedTaskIds: Set<string>;
  hasSubmittedAttempt: boolean;
  subtopicEngagement: unknown;
  lessonMarks: StudentLessonMarkCompletionRow[];
}> {
  const { data: progress, error } = await db
    .from("classroom_assignment_task_progress")
    .select("task_id")
    .eq("post_id", assignmentPostId)
    .eq("user_id", studentId);
  if (error && error.code !== "42P01") throw new Error(error.message);
  const completedTaskIds = new Set((progress ?? []).map((r) => r.task_id));

  const submittedPostIds = await fetchSubmittedAttemptPostIds(db, studentId, [assignmentPostId]);
  let hasSubmittedAttempt = submittedPostIds.has(assignmentPostId);

  const needsProfile =
    postType === "Concept Focus" ||
    (!hasSubmittedAttempt && (postType === "quiz" || postType === "assignment"));
  let subtopicEngagement: unknown = null;
  let lessonMarks: StudentLessonMarkCompletionRow[] = [];
  if (needsProfile) {
    const { data: profileRow } = await db
      .from("profiles")
      .select("subtopic_engagement, bits_test_attempts")
      .eq("id", studentId)
      .maybeSingle();
    subtopicEngagement = profileRow?.subtopic_engagement ?? null;
    if (!hasSubmittedAttempt && postType === "quiz") {
      const bitsRows = parseBitsTestAttemptsStore(profileRow?.bits_test_attempts ?? null);
      if (studentHasChapterQuizBitsAttempt(bitsRows, contentJson)) {
        hasSubmittedAttempt = true;
      }
    }
    if (postType === "Concept Focus") {
      lessonMarks = await loadStudentLessonMarksForUser(db, studentId);
    }
  }

  return { completedTaskIds, hasSubmittedAttempt, subtopicEngagement, lessonMarks };
}

/** Mirrors student feed Done rules for payout eligibility. */
export async function isStudentAssignmentCompleteForPayout(
  db: SupabaseClient,
  assignmentPostId: string,
  postType: string,
  contentJson: unknown,
  studentId: string
): Promise<boolean> {
  const ctx = await loadStudentAssignmentCompletionContext(
    db,
    assignmentPostId,
    postType,
    contentJson,
    studentId
  );
  return isStudentAssignmentComplete({
    postType,
    contentJson,
    completedTaskIds: ctx.completedTaskIds,
    hasSubmittedAttempt: ctx.hasSubmittedAttempt,
    subtopicEngagement: ctx.subtopicEngagement,
    lessonMarks: ctx.lessonMarks,
  });
}

/**
 * Legacy posts may advertise rewardRdm without escrow rows (pre-escrow publish path).
 * When a student completes, fund a single pending grant from the teacher wallet.
 */
async function ensurePendingCompletionGrantForStudent(
  admin: SupabaseClient,
  input: {
    assignmentPostId: string;
    teacherId: string;
    studentId: string;
    contentJson: unknown;
    dueAt: string | null;
  }
): Promise<boolean> {
  const amountPerStudent = parseCompletionRewardFromContentJson(input.contentJson);
  if (amountPerStudent <= 0) return false;

  const { data: existing, error: exErr } = await admin
    .from("classroom_assignment_completion_rdm_grants")
    .select("id, status")
    .eq("assignment_post_id", input.assignmentPostId)
    .eq("student_id", input.studentId)
    .maybeSingle();
  if (exErr && !isMissingGrantsTableError(exErr)) throw new Error(exErr.message);
  if (existing?.id) {
    const status = String((existing as { status?: unknown }).status ?? "");
    return status === "pending" || status === "paid";
  }

  const { count, error: countErr } = await admin
    .from("classroom_assignment_completion_rdm_grants")
    .select("id", { count: "exact", head: true })
    .eq("assignment_post_id", input.assignmentPostId);
  if (countErr && !isMissingGrantsTableError(countErr)) throw new Error(countErr.message);
  if ((count ?? 0) > 0) return false;

  const { data: newRdm, error: deductErr } = await admin.rpc("deduct_rdm", {
    uid: input.teacherId,
    amt: amountPerStudent,
  });
  if (deductErr) throw new Error(deductErr.message);
  if (newRdm === null) return false;

  const { error: insErr } = await admin.from("classroom_assignment_completion_rdm_grants").insert({
    assignment_post_id: input.assignmentPostId,
    teacher_id: input.teacherId,
    student_id: input.studentId,
    amount: amountPerStudent,
    due_at: input.dueAt,
    status: "pending" as const,
  });
  if (insErr) {
    try {
      await admin.rpc("add_rdm", { uid: input.teacherId, amt: amountPerStudent });
    } catch {
      /* best-effort */
    }
    throw new Error(insErr.message);
  }

  const prior = await readPostContentJson(admin, input.assignmentPostId);
  await admin
    .from("posts")
    .update({
      content_json: {
        ...prior,
        completionRewardRdm: amountPerStudent,
        completionRewardEscrowed: amountPerStudent,
        completionRewardStudentCount: 1,
        completionRewardLazyFunded: true,
      },
    })
    .eq("id", input.assignmentPostId)
    .eq("teacher_id", input.teacherId);

  return true;
}

export type StudentCompletionRewardStatus = {
  advertisedRdm: number;
  grantStatus: "none" | "no_escrow" | "pending" | "paid" | "refunded" | "cancelled" | "past_due";
  amount?: number;
};

/** Retry payout and describe grant state for the student checklist. */
export async function syncStudentCompletionRewardStatus(
  admin: SupabaseClient | null,
  grantClient: SupabaseClient,
  input: {
    studentId: string;
    assignmentPostId: string;
    contentJson: unknown;
    postDueAt: string | null;
  }
): Promise<StudentCompletionRewardStatus> {
  const advertisedRdm = parseCompletionRewardFromContentJson(input.contentJson);
  if (advertisedRdm <= 0) return { advertisedRdm: 0, grantStatus: "none" };

  if (admin) {
    try {
      const { fulfilled, amount } = await tryFulfillAssignmentCompletionReward(
        admin,
        input.studentId,
        input.assignmentPostId
      );
      if (fulfilled) {
        return { advertisedRdm, grantStatus: "paid", amount };
      }
    } catch {
      // fall through to grant row lookup
    }
  }

  const { data: grant, error: gErr } = await grantClient
    .from("classroom_assignment_completion_rdm_grants")
    .select("amount, status, due_at")
    .eq("assignment_post_id", input.assignmentPostId)
    .eq("student_id", input.studentId)
    .maybeSingle();

  if (gErr) {
    if (isMissingGrantsTableError(gErr)) {
      return { advertisedRdm, grantStatus: "no_escrow" };
    }
    throw new Error(gErr.message);
  }

  if (!grant) {
    return { advertisedRdm, grantStatus: "no_escrow" };
  }

  const status = String((grant as { status?: unknown }).status ?? "pending");
  const amount = Number((grant as { amount?: unknown }).amount);
  const dueAt =
    typeof (grant as { due_at?: unknown }).due_at === "string"
      ? String((grant as { due_at: string }).due_at)
      : null;

  if (status === "paid") {
    return { advertisedRdm, grantStatus: "paid", amount };
  }
  if (status === "refunded" || status === "cancelled") {
    return { advertisedRdm, grantStatus: status as "refunded" | "cancelled", amount };
  }
  if (status === "pending" && dueAt && !isBeforeOrAtDueDate(dueAt)) {
    return { advertisedRdm, grantStatus: "past_due", amount };
  }
  return { advertisedRdm, grantStatus: "pending", amount };
}

function isBeforeOrAtDueDate(dueAt: string | null | undefined): boolean {
  if (!dueAt || !String(dueAt).trim()) return true;
  const ms = Date.parse(dueAt);
  if (!Number.isFinite(ms)) return true;
  return Date.now() <= ms;
}

export type CreateCompletionGrantsResult = {
  escrowed: number;
  grantCount: number;
  amountPerStudent: number;
};

/** Deduct teacher escrow and insert pending grants (call after assignment post exists). */
export async function createCompletionGrantsOnPublish(
  admin: SupabaseClient,
  input: {
    teacherId: string;
    assignmentPostId: string;
    rewardRdm: number;
    dueAt: string | null;
    studentIds: string[];
  }
): Promise<CreateCompletionGrantsResult> {
  const amountPerStudent = normalizeCompletionRewardRdm(input.rewardRdm);
  const studentIds = [...new Set(input.studentIds.map((id) => id.trim()).filter(Boolean))];
  if (amountPerStudent <= 0 || studentIds.length === 0) {
    return { escrowed: 0, grantCount: 0, amountPerStudent: 0 };
  }

  const totalEscrow = amountPerStudent * studentIds.length;

  const { data: newRdm, error: deductErr } = await admin.rpc("deduct_rdm", {
    uid: input.teacherId,
    amt: totalEscrow,
  });
  if (deductErr) throw new Error(deductErr.message);
  if (newRdm === null) {
    throw new Error(
      `Insufficient RDM. Completion rewards require ${totalEscrow} RDM (${amountPerStudent} × ${studentIds.length} students).`
    );
  }

  const grantRows = studentIds.map((studentId) => ({
    assignment_post_id: input.assignmentPostId,
    teacher_id: input.teacherId,
    student_id: studentId,
    amount: amountPerStudent,
    due_at: input.dueAt,
    status: "pending" as const,
  }));

  const { error: insErr } = await admin
    .from("classroom_assignment_completion_rdm_grants")
    .insert(grantRows);
  if (insErr) {
    try {
      await admin.rpc("add_rdm", { uid: input.teacherId, amt: totalEscrow });
    } catch {
      /* best-effort */
    }
    throw new Error(insErr.message);
  }

  const { error: metaErr } = await admin
    .from("posts")
    .update({
      content_json: {
        ...(await readPostContentJson(admin, input.assignmentPostId)),
        completionRewardRdm: amountPerStudent,
        completionRewardEscrowed: totalEscrow,
        completionRewardStudentCount: studentIds.length,
      },
    })
    .eq("id", input.assignmentPostId)
    .eq("teacher_id", input.teacherId);
  if (metaErr) {
    await admin
      .from("classroom_assignment_completion_rdm_grants")
      .delete()
      .eq("assignment_post_id", input.assignmentPostId);
    try {
      await admin.rpc("add_rdm", { uid: input.teacherId, amt: totalEscrow });
    } catch {
      /* best-effort */
    }
    throw new Error(metaErr.message);
  }

  return { escrowed: totalEscrow, grantCount: studentIds.length, amountPerStudent };
}

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

export async function tryFulfillAssignmentCompletionReward(
  admin: SupabaseClient,
  studentId: string,
  assignmentPostId: string
): Promise<{ fulfilled: boolean; amount: number }> {
  const { data: post, error: pErr } = await admin
    .from("posts")
    .select("id, type, content_json, teacher_id, due_date")
    .eq("id", assignmentPostId)
    .maybeSingle();
  if (pErr || !post) return { fulfilled: false, amount: 0 };

  let { data: grant, error: gErr } = await admin
    .from("classroom_assignment_completion_rdm_grants")
    .select("id, amount, due_at, status, teacher_id")
    .eq("assignment_post_id", assignmentPostId)
    .eq("student_id", studentId)
    .eq("status", "pending")
    .maybeSingle();

  if (gErr) {
    if (isMissingGrantsTableError(gErr)) return { fulfilled: false, amount: 0 };
    throw new Error(gErr.message);
  }

  if (!grant?.id) {
    const dueAt =
      typeof (post as { due_date?: unknown }).due_date === "string"
        ? String((post as { due_date: string }).due_date)
        : null;
    const ensured = await ensurePendingCompletionGrantForStudent(admin, {
      assignmentPostId,
      teacherId: String((post as { teacher_id: string }).teacher_id),
      studentId,
      contentJson: post.content_json,
      dueAt,
    });
    if (!ensured) return { fulfilled: false, amount: 0 };
    const refetch = await admin
      .from("classroom_assignment_completion_rdm_grants")
      .select("id, amount, due_at, status, teacher_id")
      .eq("assignment_post_id", assignmentPostId)
      .eq("student_id", studentId)
      .eq("status", "pending")
      .maybeSingle();
    grant = refetch.data;
    gErr = refetch.error;
    if (gErr || !grant?.id) return { fulfilled: false, amount: 0 };
  }

  const dueAt =
    typeof (grant as { due_at?: unknown }).due_at === "string"
      ? String((grant as { due_at: string }).due_at)
      : null;
  if (!isBeforeOrAtDueDate(dueAt)) return { fulfilled: false, amount: 0 };

  const complete = await isStudentAssignmentCompleteForPayout(
    admin,
    assignmentPostId,
    post.type,
    post.content_json,
    studentId
  );
  if (!complete) return { fulfilled: false, amount: 0 };

  const amount = Number(grant.amount);
  if (!Number.isFinite(amount) || amount <= 0) return { fulfilled: false, amount: 0 };

  const paidAt = new Date().toISOString();
  const { data: claimed, error: claimErr } = await admin
    .from("classroom_assignment_completion_rdm_grants")
    .update({ status: "paid", paid_at: paidAt })
    .eq("id", grant.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (claimErr || !claimed?.id) return { fulfilled: false, amount: 0 };

  const { error: rpcErr } = await admin.rpc("add_rdm", { uid: studentId, amt: amount });
  if (rpcErr) {
    await admin
      .from("classroom_assignment_completion_rdm_grants")
      .update({ status: "pending", paid_at: null })
      .eq("id", grant.id)
      .eq("status", "paid");
    return { fulfilled: false, amount: 0 };
  }

  return { fulfilled: true, amount };
}

/** Pay completion rewards for Concept Focus posts matching a lesson-mark scope (classroom assignments). */
export async function tryFulfillConceptFocusRewardsForLessonScope(
  admin: SupabaseClient,
  studentId: string,
  scope: {
    board: string;
    subject: string;
    classLevel: 11 | 12;
    topic: string;
    subtopicName: string;
    level: string;
  }
): Promise<{ paidTotal: number; postIds: string[] }> {
  const { data: memberships, error: memErr } = await admin
    .from("classroom_members")
    .select("classroom_id")
    .eq("user_id", studentId);
  if (memErr) throw new Error(memErr.message);

  const classroomIds = [
    ...new Set(
      (memberships ?? [])
        .map((m) => String((m as { classroom_id: string }).classroom_id))
        .filter(Boolean)
    ),
  ];
  if (classroomIds.length === 0) return { paidTotal: 0, postIds: [] };

  const { data: posts, error: postErr } = await admin
    .from("posts")
    .select("id, content_json")
    .in("classroom_id", classroomIds)
    .eq("type", "Concept Focus");
  if (postErr) throw new Error(postErr.message);

  const markRow: StudentLessonMarkCompletionRow = {
    board: scope.board,
    subject: scope.subject,
    class_level: scope.classLevel,
    topic: scope.topic,
    subtopic: scope.subtopicName,
    level: scope.level,
    marked_complete_at: new Date().toISOString(),
  };

  let paidTotal = 0;
  const postIds: string[] = [];
  for (const post of posts ?? []) {
    const ref = parseChapterQuizRefFromContentJson(post.content_json);
    if (!ref || !chapterQuizMatchesLessonMark(ref, markRow)) continue;
    try {
      const { tryFulfillAssignmentMotivationGrants } = await import(
        "@/lib/teacherPortal/motivationRdm"
      );
      await tryFulfillAssignmentMotivationGrants(admin, studentId, post.id);
    } catch {
      /* non-fatal */
    }
    const { fulfilled, amount } = await tryFulfillAssignmentCompletionReward(
      admin,
      studentId,
      post.id
    );
    if (fulfilled && amount > 0) {
      paidTotal += amount;
      postIds.push(post.id);
    }
  }
  return { paidTotal, postIds };
}

export async function refundExpiredCompletionGrants(
  admin: SupabaseClient
): Promise<{ refundedCount: number; refundedRdm: number }> {
  const now = new Date().toISOString();
  const { data: rows, error } = await admin
    .from("classroom_assignment_completion_rdm_grants")
    .select("id, teacher_id, amount")
    .eq("status", "pending")
    .not("due_at", "is", null)
    .lt("due_at", now)
    .limit(500);

  if (error) {
    if (isMissingGrantsTableError(error)) return { refundedCount: 0, refundedRdm: 0 };
    throw new Error(error.message);
  }

  let refundedCount = 0;
  let refundedRdm = 0;
  const refundedAt = new Date().toISOString();

  for (const row of rows ?? []) {
    const amount = Number(row.amount);
    const teacherId = String(row.teacher_id);
    if (!Number.isFinite(amount) || amount <= 0) continue;

    const { data: updated, error: upErr } = await admin
      .from("classroom_assignment_completion_rdm_grants")
      .update({ status: "refunded", refunded_at: refundedAt })
      .eq("id", row.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (upErr || !updated?.id) continue;

    const { error: rpcErr } = await admin.rpc("add_rdm", { uid: teacherId, amt: amount });
    if (rpcErr) {
      await admin
        .from("classroom_assignment_completion_rdm_grants")
        .update({ status: "pending", refunded_at: null })
        .eq("id", row.id)
        .eq("status", "refunded");
      continue;
    }

    refundedCount += 1;
    refundedRdm += amount;
  }

  return { refundedCount, refundedRdm };
}

export async function cancelCompletionGrantsForAssignment(
  admin: SupabaseClient,
  assignmentPostId: string,
  teacherId: string
): Promise<{ cancelledCount: number; refundedRdm: number }> {
  const { data: pending, error } = await admin
    .from("classroom_assignment_completion_rdm_grants")
    .select("id, amount")
    .eq("assignment_post_id", assignmentPostId)
    .eq("teacher_id", teacherId)
    .eq("status", "pending");

  if (error) {
    if (isMissingGrantsTableError(error)) return { cancelledCount: 0, refundedRdm: 0 };
    throw new Error(error.message);
  }

  let cancelledCount = 0;
  let refundedRdm = 0;
  const refundedAt = new Date().toISOString();

  for (const row of pending ?? []) {
    const amount = Number(row.amount);
    const { data: updated } = await admin
      .from("classroom_assignment_completion_rdm_grants")
      .update({ status: "cancelled", refunded_at: refundedAt })
      .eq("id", row.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (!updated?.id) continue;

    const { error: rpcErr } = await admin.rpc("add_rdm", { uid: teacherId, amt: amount });
    if (rpcErr) continue;
    cancelledCount += 1;
    refundedRdm += amount;
  }

  return { cancelledCount, refundedRdm };
}
