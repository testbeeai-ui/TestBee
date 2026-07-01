import { createAdminClient } from "@/integrations/supabase/server";
import {
  computeAssignmentPublishRdm,
  computeLiveClassScheduleRdm,
} from "@/lib/teacherPortal/teacherPlanQuotaPolicy";
import {
  fetchTeacherPlanConfig,
  getTeacherPlanLimits,
  istMonthBoundsForDate,
  normalizeTeacherPlanTier,
  resolveAssignmentQuota,
  resolveLiveClassQuota,
  teacherAssignmentPublishChargeWaived,
  type QuotaOutcome,
  type TeacherPlanKey,
  type TeacherPlanLimits,
} from "@/lib/teacherPortal/teacherPlan";

export type TeacherPlanContext = {
  tier: TeacherPlanKey;
  limits: TeacherPlanLimits;
  assignmentOverageRdm: number;
  liveClassOverageRdm: number;
};

export type QuotaAssertResult =
  | {
      ok: true;
      remaining: number;
      isOverage: boolean;
      overageRdm: number;
      quota: QuotaOutcome;
    }
  | { ok: false; error: string; code: string };

export async function loadTeacherPlanContext(
  teacherId: string
): Promise<TeacherPlanContext | null> {
  const admin = createAdminClient();
  if (!admin) return null;

  const [profileRes, cfg] = await Promise.all([
    (admin as any)
      .from("profiles")
      .select(
        "teacher_plan_tier, teacher_plan_started_at, teacher_plan_expires_at, time_travel_offset_ms"
      )
      .eq("id", teacherId)
      .maybeSingle(),
    fetchTeacherPlanConfig(admin),
  ]);

  const profile = profileRes.data;
  if (!profile) return null;

  const tier = normalizeTeacherPlanTier(profile.teacher_plan_tier, profile);
  return {
    tier,
    limits: getTeacherPlanLimits(cfg, tier),
    assignmentOverageRdm: cfg.teacher_assignment_overage_rdm,
    liveClassOverageRdm: cfg.teacher_live_class_overage_rdm,
  };
}

export async function countTeacherSlotsThisMonth(
  teacherId: string,
  slotAt: Date
): Promise<number> {
  const admin = createAdminClient();
  if (!admin) return 0;

  const { start, end } = istMonthBoundsForDate(slotAt);
  const { count } = await (admin as any)
    .from("live_class_slots")
    .select("id", { count: "exact", head: true })
    .eq("teacher_id", teacherId)
    .eq("status", "scheduled")
    .gte("slot_at", start.toISOString())
    .lt("slot_at", end.toISOString());

  return count ?? 0;
}

export async function countTeacherLiveSessionsThisMonth(
  teacherId: string,
  refDate: Date
): Promise<number> {
  const admin = createAdminClient();
  if (!admin) return 0;

  const { start, end } = istMonthBoundsForDate(refDate);
  const { count } = await admin
    .from("live_sessions")
    .select("id", { count: "exact", head: true })
    .eq("teacher_id", teacherId)
    .eq("status", "scheduled")
    .gte("scheduled_at", start.toISOString())
    .lt("scheduled_at", end.toISOString());

  return count ?? 0;
}

/** Booked live classes = Google Calendar slots + legacy live_sessions (IST month). */
export async function countTeacherLiveClassesThisMonth(
  teacherId: string,
  refDate: Date = new Date()
): Promise<number> {
  const [slots, sessions] = await Promise.all([
    countTeacherSlotsThisMonth(teacherId, refDate),
    countTeacherLiveSessionsThisMonth(teacherId, refDate),
  ]);
  return slots + sessions;
}

export async function countTeacherAssignmentsThisMonth(teacherId: string): Promise<number> {
  const admin = createAdminClient();
  if (!admin) return 0;

  const { start, end } = istMonthBoundsForDate(new Date());
  const { count } = await admin
    .from("posts")
    .select("id", { count: "exact", head: true })
    .eq("teacher_id", teacherId)
    .eq("type", "assignment")
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString());

  return count ?? 0;
}

export async function countSectionStudents(
  classroomId: string,
  sectionId: string
): Promise<number> {
  const admin = createAdminClient();
  if (!admin) return 0;

  const { count } = await admin
    .from("classroom_members")
    .select("user_id", { count: "exact", head: true })
    .eq("classroom_id", classroomId)
    .eq("section_id", sectionId)
    .neq("role", "teacher");

  return count ?? 0;
}

function quotaAssertFromOutcome(outcome: QuotaOutcome): QuotaAssertResult {
  if (outcome.kind === "blocked_upgrade") {
    return {
      ok: false,
      error: outcome.message,
      code: outcome.upgradeTo === "starter" ? "upgrade_starter_required" : "upgrade_pro_required",
    };
  }
  return {
    ok: true,
    remaining: outcome.remaining,
    isOverage: outcome.isOverage,
    overageRdm: outcome.kind === "allowed_overage" ? outcome.overageRdm : 0,
    quota: outcome,
  };
}

export async function assertTeacherCanBookSlot(
  teacherId: string,
  slotAt: Date
): Promise<QuotaAssertResult> {
  const ctx = await loadTeacherPlanContext(teacherId);
  if (!ctx) return { ok: false, error: "Could not load plan", code: "plan_load_failed" };

  const booked = await countTeacherLiveClassesThisMonth(teacherId, slotAt);
  const outcome = resolveLiveClassQuota(
    ctx.tier,
    booked,
    ctx.limits,
    ctx.liveClassOverageRdm
  );
  return quotaAssertFromOutcome(outcome);
}

export async function assertTeacherCanCreateAssignment(
  teacherId: string
): Promise<QuotaAssertResult> {
  const ctx = await loadTeacherPlanContext(teacherId);
  if (!ctx) return { ok: false, error: "Could not load plan", code: "plan_load_failed" };

  const created = await countTeacherAssignmentsThisMonth(teacherId);
  const outcome = resolveAssignmentQuota(
    ctx.tier,
    created,
    ctx.limits,
    ctx.assignmentOverageRdm
  );
  return quotaAssertFromOutcome(outcome);
}

export async function computeTeacherAssignmentPublishCharge(
  teacherId: string,
  flatPublishFee: number
): Promise<
  | { ok: true; amount: number; quota: QuotaOutcome; isOverage: boolean }
  | { ok: false; error: string; code: string }
> {
  const check = await assertTeacherCanCreateAssignment(teacherId);
  if (!check.ok) return check;
  const ctx = await loadTeacherPlanContext(teacherId);
  if (!ctx) return { ok: false, error: "Could not load plan", code: "plan_load_failed" };
  const amount = computeAssignmentPublishRdm({
    tier: ctx.tier,
    quota: check.quota,
    flatPublishFee,
  });
  return { ok: true, amount, quota: check.quota, isOverage: check.isOverage };
}

export async function computeTeacherLiveClassScheduleCharge(
  teacherId: string,
  refDate: Date,
  flatScheduleFee: number
): Promise<
  | { ok: true; amount: number; quota: QuotaOutcome; isOverage: boolean }
  | { ok: false; error: string; code: string }
> {
  const check = await assertTeacherCanBookSlot(teacherId, refDate);
  if (!check.ok) return check;
  const amount = computeLiveClassScheduleRdm({
    quota: check.quota,
    flatScheduleFee,
  });
  return { ok: true, amount, quota: check.quota, isOverage: check.isOverage };
}

export async function countClassroomStudents(classroomId: string): Promise<number> {
  const admin = createAdminClient();
  if (!admin) return 0;

  const { count } = await admin
    .from("classroom_members")
    .select("user_id", { count: "exact", head: true })
    .eq("classroom_id", classroomId)
    .neq("role", "teacher");

  return count ?? 0;
}

export async function assertClassroomHasStudentCapacity(
  teacherId: string,
  classroomId: string,
  adding = 1
): Promise<{ ok: true } | { ok: false; error: string; code: string }> {
  const ctx = await loadTeacherPlanContext(teacherId);
  if (!ctx) return { ok: false, error: "Could not load plan", code: "plan_load_failed" };

  const current = await countClassroomStudents(classroomId);
  if (current + adding > ctx.limits.studentsPerClass) {
    return {
      ok: false,
      error: `This class is capped at ${ctx.limits.studentsPerClass} students on your plan. Upgrade to add more.`,
      code: "students_cap_reached",
    };
  }
  return { ok: true };
}

export async function assertSectionHasStudentCapacity(
  teacherId: string,
  classroomId: string,
  sectionId: string,
  adding = 1
): Promise<{ ok: true } | { ok: false; error: string; code: string }> {
  const ctx = await loadTeacherPlanContext(teacherId);
  if (!ctx) return { ok: false, error: "Could not load plan", code: "plan_load_failed" };

  const current = await countSectionStudents(classroomId, sectionId);
  if (current + adding > ctx.limits.studentsPerClass) {
    return {
      ok: false,
      error: `This section is capped at ${ctx.limits.studentsPerClass} students on your plan.`,
      code: "students_cap_reached",
    };
  }
  return { ok: true };
}

export async function shouldWaiveTeacherAssignmentPublishCharge(
  teacherId: string
): Promise<boolean> {
  const ctx = await loadTeacherPlanContext(teacherId);
  if (!ctx || ctx.tier !== "pro") return false;
  const created = await countTeacherAssignmentsThisMonth(teacherId);
  const outcome = resolveAssignmentQuota(
    ctx.tier,
    created,
    ctx.limits,
    ctx.assignmentOverageRdm
  );
  return teacherAssignmentPublishChargeWaived(ctx.tier, outcome.isOverage);
}
