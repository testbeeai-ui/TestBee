import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  MotivationNudgeGoal,
  MotivationRecommendActionId,
} from "@/lib/teacherPortal/queries/mutations";
import type { StudentMessageKind } from "@/lib/teacherPortal/studentNotificationCopy";
import {
  assertTeacherApprovedForMutations,
  type TeacherMutationGuardOptions,
} from "@/lib/teacherPortal/queries/guards";
import {
  assertRelatedAssignmentPost,
  effectiveMotivationRdmDelta,
  normalizeInstantMotivationRdm,
  payInstantMotivationRdmToStudents,
  tryFulfillAssignmentMotivationGrants,
} from "@/lib/teacherPortal/motivationRdm";
import { sendMotivationPushToStudents } from "@/lib/mobile/sendMotivationPush";

export type SendTeacherMotivationInput = {
  teacherId: string;
  classroomId: string;
  sectionId?: string | null;
  actionKind: "boost" | "nudge" | "urgent_nudge" | "reward_top_students";
  targetStudentIds: string[];
  message: string;
  rdmDelta: number;
  relatedPostId?: string;
  relatedPostTitle?: string;
  recommendActionId?: MotivationRecommendActionId;
  recommendActionLabel?: string;
  recommendActionUrl?: string;
  notificationTitle?: string;
  nudgeGoal?: MotivationNudgeGoal;
  /** Student bell category + layout (assignment vs counsel vs nudge). */
  studentMessageKind?: StudentMessageKind;
};

export type SendTeacherMotivationResult = {
  motivationPostId: string;
  effectiveRdmDelta: number;
  teacherCharged: number;
  grantsCreated: number;
  grantsPaid: number;
  grantsPending: number;
  instantRdmPaid: number;
};

async function insertMotivationPost(
  db: SupabaseClient,
  input: SendTeacherMotivationInput,
  effectiveDelta: number
): Promise<string> {
  const trimmedNotificationTitle = input.notificationTitle?.trim();
  const { data, error } = await db
    .from("posts")
    .insert({
      classroom_id: input.classroomId,
      section_id: input.sectionId ?? null,
      teacher_id: input.teacherId,
      type: "motivation",
      title: input.message.trim() || "Motivation action",
      visibility: "classroom",
      description:
        input.actionKind === "reward_top_students"
          ? `reward_top_students sent to ${input.targetStudentIds.length} student(s)`
          : `${input.actionKind} sent to ${input.targetStudentIds.length} student(s)`,
      content_json: {
        actionKind: input.actionKind,
        message: input.message.trim() || "Keep going!",
        targetStudentIds: input.targetStudentIds,
        rdmDelta: effectiveDelta,
        ...(input.relatedPostId ? { relatedPostId: input.relatedPostId } : {}),
        ...(input.relatedPostTitle ? { relatedPostTitle: input.relatedPostTitle } : {}),
        ...(input.recommendActionId ? { recommendActionId: input.recommendActionId } : {}),
        ...(input.recommendActionLabel
          ? { recommendActionLabel: input.recommendActionLabel }
          : {}),
        ...(input.recommendActionUrl ? { recommendActionUrl: input.recommendActionUrl } : {}),
        ...(trimmedNotificationTitle ? { notificationTitle: trimmedNotificationTitle } : {}),
        ...(input.nudgeGoal ? { nudgeGoal: input.nudgeGoal } : {}),
        ...(input.studentMessageKind ? { studentMessageKind: input.studentMessageKind } : {}),
      },
    })
    .select("id")
    .single();
  if (error || !data?.id) throw new Error(error?.message ?? "Could not create motivation post.");
  return data.id as string;
}

export async function sendTeacherMotivation(
  admin: SupabaseClient,
  input: SendTeacherMotivationInput,
  options?: TeacherMutationGuardOptions
): Promise<SendTeacherMotivationResult> {
  await assertTeacherApprovedForMutations(input.teacherId, admin, options);

  const targetStudentIds = [...new Set(input.targetStudentIds.map((id) => id.trim()).filter(Boolean))];
  if (targetStudentIds.length === 0) {
    throw new Error("Select at least one student.");
  }

  const relatedPostId = input.relatedPostId?.trim() || null;
  const effectiveDelta = effectiveMotivationRdmDelta(input.rdmDelta, relatedPostId);
  const instantPerStudent =
    !relatedPostId ? normalizeInstantMotivationRdm(input.rdmDelta) : 0;
  const canInstantPay =
    instantPerStudent > 0 &&
    !relatedPostId &&
    (input.actionKind === "reward_top_students" || input.actionKind === "boost");
  const postRdmDelta = effectiveDelta > 0 ? effectiveDelta : canInstantPay ? instantPerStudent : 0;

  if (effectiveDelta > 0 && relatedPostId) {
    await assertRelatedAssignmentPost(admin, input.classroomId, relatedPostId, input.teacherId);
  }

  const totalCharge =
    effectiveDelta > 0 && relatedPostId ? effectiveDelta * targetStudentIds.length : 0;

  let teacherCharged = 0;
  if (totalCharge > 0) {
    const { data: newRdm, error: rpcErr } = await admin.rpc("deduct_rdm", {
      uid: input.teacherId,
      amt: totalCharge,
    });
    if (rpcErr) throw new Error(rpcErr.message);
    if (newRdm === null) {
      throw new Error(
        `Insufficient RDM. This send requires ${totalCharge} RDM (${effectiveDelta} × ${targetStudentIds.length} students).`
      );
    }
    teacherCharged = totalCharge;
  }

  let motivationPostId: string;
  try {
    motivationPostId = await insertMotivationPost(admin, input, postRdmDelta);
  } catch (e) {
    if (teacherCharged > 0) {
      try {
        await admin.rpc("add_rdm", { uid: input.teacherId, amt: teacherCharged });
      } catch {
        /* best-effort refund */
      }
    }
    throw e;
  }

  let grantsCreated = 0;
  let grantsPaid = 0;
  let instantRdmPaid = 0;

  if (effectiveDelta > 0 && relatedPostId) {
    const grantRows = targetStudentIds.map((studentId) => ({
      motivation_post_id: motivationPostId,
      student_id: studentId,
      assignment_post_id: relatedPostId,
      amount: effectiveDelta,
      status: "pending",
    }));
    const { error: insErr } = await admin.from("teacher_motivation_rdm_grants").insert(grantRows);
    if (insErr) {
      await admin.from("posts").delete().eq("id", motivationPostId);
      if (teacherCharged > 0) {
        try {
          await admin.rpc("add_rdm", { uid: input.teacherId, amt: teacherCharged });
        } catch {
          /* best-effort refund */
        }
      }
      throw new Error(insErr.message);
    }
    grantsCreated = grantRows.length;

    for (const studentId of targetStudentIds) {
      const { fulfilled, amounts } = await tryFulfillAssignmentMotivationGrants(
        admin,
        studentId,
        relatedPostId
      );
      grantsPaid += fulfilled;
      instantRdmPaid += amounts.reduce((sum, n) => sum + n, 0);
    }
  } else if (canInstantPay) {
    try {
      const instant = await payInstantMotivationRdmToStudents(
        admin,
        input.teacherId,
        targetStudentIds,
        instantPerStudent
      );
      teacherCharged = instant.charged;
      instantRdmPaid = instant.paidTotal;
    } catch (e) {
      await admin.from("posts").delete().eq("id", motivationPostId);
      throw e;
    }
  }

  const pushTitle =
    input.notificationTitle?.trim() ||
    (input.actionKind === "reward_top_students" ? "Recognition from your teacher" : "Message from your teacher");
  void sendMotivationPushToStudents(admin, {
    targetStudentIds,
    title: pushTitle,
    body: input.message.trim() || "Keep going!",
    motivationPostId,
  });

  return {
    motivationPostId,
    effectiveRdmDelta: postRdmDelta,
    teacherCharged,
    grantsCreated,
    grantsPaid,
    grantsPending: Math.max(0, grantsCreated - grantsPaid),
    instantRdmPaid,
  };
}
