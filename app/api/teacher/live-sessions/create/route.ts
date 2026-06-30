import { NextResponse } from "next/server";
import { createAdminClient } from "@/integrations/supabase/server";
import {
  enforceSameOriginForCookieAuth,
  requireAuthenticatedUser,
} from "@/lib/auth/securityGuards";
import { createTeacherLiveSession } from "@/lib/teacherPortal/queries/mutations";
import {
  assertTeacherCanBookSlot,
  computeTeacherLiveClassScheduleCharge,
} from "@/lib/teacherPortal/teacherPlanServer";
import {
  fetchTeacherRdmCosts,
  getChargeAmountForAction,
} from "@/lib/teacherPortal/teacherRdmConfig";
import { readTeacherRdmBalance } from "@/lib/teacherPortal/creditTeacherRdmBalance";
import type { AdvancedQuizSetIndex } from "@/lib/play/quiz/advancedQuizSets";

export const runtime = "nodejs";

type Body = {
  classroomId?: string;
  sectionId?: string | null;
  title?: string;
  date?: string;
  startTime?: string;
  durationMinutes?: number;
  meetLink?: string;
  allowAdhocTrial?: boolean;
  preWork?: string;
  postWork?: string;
  preWorkMode?: "none" | "custom" | "concept_focus";
  preWorkConceptRef?: {
    board: string;
    subject: "physics" | "chemistry" | "math";
    classLevel: 11 | 12;
    chapterTitle: string;
    topic: string;
    subtopicName: string;
    level: "basics" | "intermediate" | "advanced";
    advancedSet?: AdvancedQuizSetIndex;
  } | null;
  postWorkMode?: "none" | "custom" | "concept_focus";
  postWorkConceptRef?: {
    board: string;
    subject: "physics" | "chemistry" | "math";
    classLevel: 11 | 12;
    chapterTitle: string;
    topic: string;
    subtopicName: string;
    level: "basics" | "intermediate" | "advanced";
    advancedSet?: AdvancedQuizSetIndex;
  } | null;
  postWorkDelayDays?: number;
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

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const teacherId = auth.user.id;
  const date = typeof body.date === "string" ? body.date.trim() : "";
  const startTime = typeof body.startTime === "string" ? body.startTime.trim() : "";
  const scheduledAt = new Date(`${date}T${startTime}:00`);
  if (!date || !startTime || Number.isNaN(scheduledAt.getTime())) {
    return NextResponse.json({ error: "Valid date and start time required" }, { status: 400 });
  }

  const quota = await assertTeacherCanBookSlot(teacherId, scheduledAt);
  if (!quota.ok) {
    return NextResponse.json({ error: quota.error, code: quota.code }, { status: 403 });
  }

  const costs = await fetchTeacherRdmCosts(admin);
  const flatScheduleFee = getChargeAmountForAction(costs, "schedule_session");
  const scheduleCharge = await computeTeacherLiveClassScheduleCharge(
    teacherId,
    scheduledAt,
    flatScheduleFee
  );
  if (!scheduleCharge.ok) {
    return NextResponse.json(
      { error: scheduleCharge.error, code: scheduleCharge.code },
      { status: 403 }
    );
  }

  let scheduleCharged = 0;
  const refundScheduleCharge = async () => {
    if (scheduleCharged <= 0) return;
    try {
      await admin.rpc("add_rdm", { uid: teacherId, amt: scheduleCharged });
    } catch {
      /* best-effort */
    }
    scheduleCharged = 0;
  };

  if (scheduleCharge.amount > 0) {
    const { data: newRdm, error: deductErr } = await admin.rpc("deduct_rdm", {
      uid: teacherId,
      amt: scheduleCharge.amount,
    });
    if (deductErr) {
      return NextResponse.json({ error: deductErr.message }, { status: 500 });
    }
    if (newRdm === null) {
      return NextResponse.json(
        {
          error: `Insufficient RDM. Scheduling costs ${scheduleCharge.amount} RDM.`,
          amount: scheduleCharge.amount,
        },
        { status: 402 }
      );
    }
    scheduleCharged = scheduleCharge.amount;
  }

  try {
    await createTeacherLiveSession(
      {
        teacherId,
        classroomId: String(body.classroomId ?? "").trim(),
        sectionId: body.sectionId ?? null,
        title: String(body.title ?? "").trim(),
        date,
        startTime,
        durationMinutes: Number(body.durationMinutes ?? 60),
        meetLink: String(body.meetLink ?? "").trim(),
        allowAdhocTrial: body.allowAdhocTrial === true,
        preWork: String(body.preWork ?? ""),
        postWork: String(body.postWork ?? ""),
        preWorkMode: body.preWorkMode,
        preWorkConceptRef: body.preWorkConceptRef ?? null,
        postWorkMode: body.postWorkMode,
        postWorkConceptRef: body.postWorkConceptRef ?? null,
        postWorkDelayDays: body.postWorkDelayDays,
      },
      admin,
      { skipPlanQuotaCheck: true }
    );

    const walletRdm = await readTeacherRdmBalance(admin, teacherId);

    return NextResponse.json({
      ok: true,
      scheduleFee: scheduleCharged,
      isOverage: scheduleCharge.isOverage,
      remainingThisMonth: quota.remaining,
      rdm: walletRdm,
    });
  } catch (e) {
    await refundScheduleCharge();
    const msg = e instanceof Error ? e.message : "Could not schedule session.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
