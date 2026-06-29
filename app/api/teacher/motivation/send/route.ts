import { NextResponse } from "next/server";
import { createAdminClient } from "@/integrations/supabase/server";
import {
  enforceSameOriginForCookieAuth,
  requireAuthenticatedUser,
} from "@/lib/auth/securityGuards";
import { sendTeacherMotivation, type SendTeacherMotivationInput } from "@/lib/teacherPortal/sendTeacherMotivation";
import type {
  MotivationNudgeGoal,
  MotivationRecommendActionId,
} from "@/lib/teacherPortal/queries/mutations";
import { isStudentMessageKind } from "@/lib/teacherPortal/studentNotificationCopy";

function parseActionKind(raw: unknown): SendTeacherMotivationInput["actionKind"] | null {
  if (
    raw === "boost" ||
    raw === "nudge" ||
    raw === "urgent_nudge" ||
    raw === "reward_top_students"
  ) {
    return raw;
  }
  return null;
}

function parseNudgeGoal(raw: unknown): MotivationNudgeGoal | undefined {
  if (
    raw === "restart_streak" ||
    raw === "complete_pending_assignment" ||
    raw === "attempt_mock" ||
    raw === "answer_doubts" ||
    raw === "revise_chapter" ||
    raw === "watch_recorded_class"
  ) {
    return raw;
  }
  return undefined;
}

function parseRecommendAction(raw: unknown): MotivationRecommendActionId | undefined {
  if (
    raw === "attempt_targeted_mock" ||
    raw === "post_doubt" ||
    raw === "watch_recorded" ||
    raw === "concept_focus_resource" ||
    raw === "none"
  ) {
    return raw;
  }
  return undefined;
}

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

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const classroomId = typeof body.classroomId === "string" ? body.classroomId.trim() : "";
  if (!classroomId) {
    return NextResponse.json({ error: "classroomId is required" }, { status: 400 });
  }

  const actionKind = parseActionKind(body.actionKind);
  if (!actionKind) {
    return NextResponse.json({ error: "Invalid actionKind" }, { status: 400 });
  }

  const targetStudentIds = Array.isArray(body.targetStudentIds)
    ? body.targetStudentIds.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    : [];
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const rdmDelta = Number.isFinite(body.rdmDelta) ? Math.round(Number(body.rdmDelta)) : 0;

  const input: SendTeacherMotivationInput = {
    teacherId: auth.user.id,
    classroomId,
    sectionId: typeof body.sectionId === "string" ? body.sectionId : null,
    actionKind,
    targetStudentIds,
    message,
    rdmDelta,
    relatedPostId:
      typeof body.relatedPostId === "string" && body.relatedPostId.trim()
        ? body.relatedPostId.trim()
        : undefined,
    relatedPostTitle:
      typeof body.relatedPostTitle === "string" && body.relatedPostTitle.trim()
        ? body.relatedPostTitle.trim()
        : undefined,
    recommendActionId: parseRecommendAction(body.recommendActionId),
    recommendActionLabel:
      typeof body.recommendActionLabel === "string" && body.recommendActionLabel.trim()
        ? body.recommendActionLabel.trim()
        : undefined,
    recommendActionUrl:
      typeof body.recommendActionUrl === "string" && body.recommendActionUrl.trim()
        ? body.recommendActionUrl.trim()
        : undefined,
    notificationTitle:
      typeof body.notificationTitle === "string" && body.notificationTitle.trim()
        ? body.notificationTitle.trim()
        : undefined,
    nudgeGoal: parseNudgeGoal(body.nudgeGoal),
    studentMessageKind:
      isStudentMessageKind((body as { studentMessageKind?: unknown }).studentMessageKind) ?
        (body as { studentMessageKind: SendTeacherMotivationInput["studentMessageKind"] })
          .studentMessageKind
      : undefined,
  };

  try {
    const result = await sendTeacherMotivation(admin, input);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not send motivation.";
    const insufficient = msg.toLowerCase().includes("insufficient rdm");
    return NextResponse.json({ error: msg }, { status: insufficient ? 402 : 400 });
  }
}
