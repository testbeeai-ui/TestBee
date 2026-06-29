import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAuthenticatedUser } from "@/lib/auth/securityGuards";
import { createAdminClient } from "@/integrations/supabase/server";
import {
  createCompletionGrantsOnPublish,
  isStudentAssignmentCompleteForPayout,
  normalizeCompletionRewardRdm,
  parseCompletionRewardFromContentJson,
  resolveAssignmentTargetStudentIds,
  tryFulfillAssignmentCompletionReward,
} from "@/lib/teacherPortal/assignmentCompletionRdm";

type Body = {
  rewardRdm?: number;
  confirmCompletionEscrow?: boolean;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const auth = await requireAuthenticatedUser(request);
  if ("response" in auth) return auth.response;

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const { postId } = await params;
  if (!postId?.trim()) {
    return NextResponse.json({ error: "postId required" }, { status: 400 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rewardRdm = normalizeCompletionRewardRdm(body.rewardRdm ?? 0);
  if (rewardRdm <= 0) {
    return NextResponse.json({ error: "rewardRdm must be positive" }, { status: 400 });
  }
  if (body.confirmCompletionEscrow !== true) {
    return NextResponse.json(
      {
        error: "Confirmation required for completion reward escrow.",
        code: "completion_escrow_confirmation_required",
        rewardRdm,
      },
      { status: 428 }
    );
  }

  const { data: post, error: postErr } = await admin
    .from("posts")
    .select("id, classroom_id, teacher_id, type, content_json, due_date, section_id")
    .eq("id", postId)
    .maybeSingle();
  if (postErr || !post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  if (post.teacher_id !== auth.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existingReward = parseCompletionRewardFromContentJson(post.content_json);
  const grantsDb = admin as SupabaseClient;
  const { count: grantCount } = await grantsDb
    .from("classroom_assignment_completion_rdm_grants")
    .select("id", { count: "exact", head: true })
    .eq("assignment_post_id", postId);
  if ((grantCount ?? 0) > 0) {
    return NextResponse.json(
      { error: "Completion rewards already funded for this assignment." },
      { status: 409 }
    );
  }

  const content =
    post.content_json && typeof post.content_json === "object" && !Array.isArray(post.content_json)
      ? (post.content_json as Record<string, unknown>)
      : {};
  const targetStudentIds = Array.isArray(content.targetStudentIds)
    ? (content.targetStudentIds as string[])
    : null;
  const sectionId =
    typeof (post as { section_id?: unknown }).section_id === "string"
      ? String((post as { section_id: string }).section_id)
      : null;

  const studentIds = await resolveAssignmentTargetStudentIds(admin, {
    classroomId: post.classroom_id,
    sectionId,
    targetStudentIds,
  });
  if (studentIds.length === 0) {
    return NextResponse.json({ error: "No students in assignment audience." }, { status: 400 });
  }

  const dueAt =
    typeof (post as { due_date?: unknown }).due_date === "string"
      ? String((post as { due_date: string }).due_date)
      : null;

  if (existingReward <= 0) {
    await admin
      .from("posts")
      .update({
        content_json: { ...content, rewardRdm },
      })
      .eq("id", postId)
      .eq("teacher_id", auth.user.id);
  }

  const escrowResult = await createCompletionGrantsOnPublish(admin, {
    teacherId: auth.user.id,
    assignmentPostId: postId,
    rewardRdm,
    dueAt,
    studentIds,
  });

  let paidCount = 0;
  let paidTotal = 0;
  for (const studentId of studentIds) {
    const complete = await isStudentAssignmentCompleteForPayout(
      admin,
      postId,
      post.type,
      { ...content, rewardRdm },
      studentId
    );
    if (!complete) continue;
    const { fulfilled, amount } = await tryFulfillAssignmentCompletionReward(
      admin,
      studentId,
      postId
    );
    if (fulfilled) {
      paidCount += 1;
      paidTotal += amount;
    }
  }

  return NextResponse.json({
    ok: true,
    rewardRdm,
    escrowTotal: escrowResult.escrowed,
    grantCount: escrowResult.grantCount,
    paidCount,
    paidTotal,
  });
}
