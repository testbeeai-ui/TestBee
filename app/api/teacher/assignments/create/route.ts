import { NextResponse } from "next/server";
import { createAdminClient } from "@/integrations/supabase/server";
import {
  enforceSameOriginForCookieAuth,
  requireAuthenticatedUser,
} from "@/lib/auth/securityGuards";
import { createClassroomAssignment } from "@/lib/teacherPortal/queries/mutations";
import type { AssignmentTaskStored } from "@/lib/classroom/assignmentTasks";
import type { Json } from "@/integrations/supabase/types";
import type {
  TeacherPortalChapterQuizRef,
  TeacherPortalDailyDoseStreakRef,
  TeacherPortalGyanEngagementRef,
  TeacherPortalMockPaperRef,
  TeacherPortalPastPaperRef,
} from "@/lib/teacherPortal/types";
import {
  createCompletionGrantsOnPublish,
  normalizeCompletionRewardRdm,
  resolveAssignmentTargetStudentIds,
} from "@/lib/teacherPortal/assignmentCompletionRdm";
import {
  createSubtopicUnlockGrantsOnPublish,
  fetchSubtopicUnlockRdmPerStudent,
  refundSubtopicUnlockGrantsForPost,
} from "@/lib/teacherPortal/subtopicUnlockRdm";
import { assertTeacherCanCreateAssignment } from "@/lib/teacherPortal/teacherPlanServer";
import {
  fetchTeacherRdmCosts,
  getChargeAmountForAction,
} from "@/lib/teacherPortal/teacherRdmConfig";
import { shouldWaiveTeacherAssignmentPublishCharge } from "@/lib/teacherPortal/teacherPlanServer";

export const runtime = "nodejs";

type CreateAssignmentBody = {
  teacherId?: string;
  classroomId?: string;
  sectionId?: string | null;
  assignmentType?: string;
  title?: string;
  dueDate?: string | null;
  assignToLabel?: string;
  targetStudentIds?: string[] | null;
  rewardRdm?: number;
  instructions?: string;
  tasks?: AssignmentTaskStored[];
  mockPaper?: TeacherPortalMockPaperRef | null;
  pastPaper?: TeacherPortalPastPaperRef | null;
  chapterQuiz?: TeacherPortalChapterQuizRef | null;
  dailyDoseStreak?: TeacherPortalDailyDoseStreakRef | null;
  gyanEngagement?: TeacherPortalGyanEngagementRef | null;
  extraContentJson?: Record<string, Json> | null;
  confirmCompletionEscrow?: boolean;
  confirmSubtopicUnlock?: boolean;
};

export async function POST(request: Request) {
  const csrf = enforceSameOriginForCookieAuth(request);
  if (csrf) return csrf;

  const auth = await requireAuthenticatedUser(request);
  if ("response" in auth) return auth.response;

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (profile?.role !== "teacher") {
    return NextResponse.json({ error: "Teacher account required" }, { status: 403 });
  }

  let body: CreateAssignmentBody;
  try {
    body = (await request.json()) as CreateAssignmentBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const teacherId = auth.user.id;
  const classroomId = typeof body.classroomId === "string" ? body.classroomId.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const assignmentType = typeof body.assignmentType === "string" ? body.assignmentType.trim() : "";

  if (!classroomId || !title || !assignmentType) {
    return NextResponse.json(
      { error: "classroomId, title, and assignmentType are required" },
      { status: 400 }
    );
  }

  const isConceptFocus = assignmentType === "Concept Focus";
  const rewardRdm = normalizeCompletionRewardRdm(body.rewardRdm ?? 0);
  const assignToLabel =
    typeof body.assignToLabel === "string" && body.assignToLabel.trim()
      ? body.assignToLabel.trim()
      : "Class";

  const quota = await assertTeacherCanCreateAssignment(teacherId);
  if (!quota.ok) {
    return NextResponse.json({ error: quota.error, code: quota.code }, { status: 403 });
  }

  const studentIds = await resolveAssignmentTargetStudentIds(admin, {
    classroomId,
    sectionId: body.sectionId ?? null,
    targetStudentIds: body.targetStudentIds ?? null,
  });

  const unlockPerStudent = isConceptFocus ? await fetchSubtopicUnlockRdmPerStudent(admin) : 0;
  const unlockTotal = isConceptFocus ? unlockPerStudent * studentIds.length : 0;

  if (isConceptFocus && studentIds.length === 0) {
    return NextResponse.json(
      { error: "No students in the selected audience for subtopic unlock." },
      { status: 400 }
    );
  }
  if (isConceptFocus && unlockTotal > 0 && body.confirmSubtopicUnlock !== true) {
    return NextResponse.json(
      {
        error: "Confirmation required for subtopic unlock charge.",
        code: "subtopic_unlock_confirmation_required",
        unlockPerStudent,
        studentCount: studentIds.length,
        unlockTotal,
      },
      { status: 428 }
    );
  }

  const escrowTotal = rewardRdm > 0 ? rewardRdm * studentIds.length : 0;
  if (rewardRdm > 0 && studentIds.length === 0) {
    return NextResponse.json(
      { error: "No students in the selected audience for completion rewards." },
      { status: 400 }
    );
  }
  if (rewardRdm > 0 && body.confirmCompletionEscrow !== true) {
    return NextResponse.json(
      {
        error: "Confirmation required for completion reward escrow.",
        code: "completion_escrow_confirmation_required",
        rewardRdm,
        studentCount: studentIds.length,
        escrowTotal,
      },
      { status: 428 }
    );
  }

  const costs = await fetchTeacherRdmCosts(admin);
  const publishAmount = isConceptFocus ? 0 : getChargeAmountForAction(costs, "create_assignment");
  let publishCharged = 0;
  let postId: string | null = null;

  const refundPublishCharge = async () => {
    if (publishCharged <= 0) return;
    try {
      await admin.rpc("add_rdm", { uid: teacherId, amt: publishCharged });
    } catch {
      /* best-effort */
    }
    publishCharged = 0;
  };

  try {
    const waivePublish = isConceptFocus || (await shouldWaiveTeacherAssignmentPublishCharge(teacherId));
    if (!waivePublish && publishAmount > 0) {
      const { data: newRdm, error: pubErr } = await admin.rpc("deduct_rdm", {
        uid: teacherId,
        amt: publishAmount,
      });
      if (pubErr) throw new Error(pubErr.message);
      if (newRdm === null) {
        return NextResponse.json(
          {
            error: `Insufficient RDM. Publishing costs ${publishAmount} RDM.`,
            amount: publishAmount,
          },
          { status: 402 }
        );
      }
      publishCharged = publishAmount;
    }

    const dueDate =
      typeof body.dueDate === "string" && body.dueDate.trim() ? body.dueDate.trim() : null;
    const dueDateIso = dueDate ? new Date(`${dueDate}T23:59:00`).toISOString() : null;

    const created = await createClassroomAssignment(
      {
        teacherId,
        classroomId,
        sectionId: body.sectionId ?? null,
        assignmentType,
        title,
        dueDate,
        assignToLabel,
        targetStudentIds: body.targetStudentIds ?? null,
        rewardRdm,
        instructions: typeof body.instructions === "string" ? body.instructions : "",
        tasks: body.tasks,
        mockPaper: body.mockPaper ?? null,
        pastPaper: body.pastPaper ?? null,
        chapterQuiz: body.chapterQuiz ?? null,
        dailyDoseStreak: body.dailyDoseStreak ?? null,
        gyanEngagement: body.gyanEngagement ?? null,
        extraContentJson: body.extraContentJson ?? null,
      },
      admin
    );
    postId = created.id;

    let unlockResult = { unlockTotal: 0, grantCount: 0, amountPerStudent: 0 };
    if (isConceptFocus && studentIds.length > 0) {
      const { data: postRow } = await admin
        .from("posts")
        .select("content_json")
        .eq("id", created.id)
        .maybeSingle();
      unlockResult = await createSubtopicUnlockGrantsOnPublish(admin, {
        teacherId,
        assignmentPostId: created.id,
        contentJson: postRow?.content_json ?? null,
        studentIds,
        amountPerStudent: unlockPerStudent,
      });
    }

    let escrowResult = { escrowed: 0, grantCount: 0, amountPerStudent: 0 };
    if (rewardRdm > 0) {
      escrowResult = await createCompletionGrantsOnPublish(admin, {
        teacherId,
        assignmentPostId: created.id,
        rewardRdm,
        dueAt: dueDateIso,
        studentIds,
      });
    }

    return NextResponse.json({
      ok: true,
      id: created.id,
      rewardRdm,
      escrowTotal: escrowResult.escrowed,
      grantCount: escrowResult.grantCount,
      unlockTotal: unlockResult.unlockTotal,
      unlockGrantCount: unlockResult.grantCount,
      publishFee: publishCharged,
    });
  } catch (e) {
    if (postId) {
      await refundSubtopicUnlockGrantsForPost(admin, postId, teacherId);
      await admin.from("posts").delete().eq("id", postId).eq("teacher_id", teacherId);
    }
    await refundPublishCharge();
    const msg = e instanceof Error ? e.message : "Could not create assignment.";
    const insufficient = msg.toLowerCase().includes("insufficient rdm");
    return NextResponse.json({ error: msg }, { status: insufficient ? 402 : 400 });
  }
}

