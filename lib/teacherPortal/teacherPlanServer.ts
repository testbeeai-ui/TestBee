import { createAdminClient } from "@/integrations/supabase/server";
import {
  assignmentQuotaExceededMessage,
  canBookMoreLiveClasses,
  canCreateMoreAssignments,
  fetchTeacherPlanConfig,
  getTeacherPlanLimits,
  istMonthBoundsForDate,
  liveClassQuotaExceededMessage,
  normalizeTeacherPlanTier,
  teacherAssignmentPublishChargeWaived,
  type TeacherPlanKey,
  type TeacherPlanLimits,
} from "@/lib/teacherPortal/teacherPlan";

export type TeacherPlanContext = {
  tier: TeacherPlanKey;
  limits: TeacherPlanLimits;
};

export async function loadTeacherPlanContext(
  teacherId: string
): Promise<TeacherPlanContext | null> {
  const admin = createAdminClient();
  if (!admin) return null;

  const [profileRes, cfg] = await Promise.all([
    (admin as any)
      .from("profiles")
      .select("teacher_plan_tier, teacher_plan_started_at, teacher_plan_expires_at, time_travel_offset_ms")
      .eq("id", teacherId)
      .maybeSingle(),
    fetchTeacherPlanConfig(admin),
  ]);

  const profile = profileRes.data;
  if (!profile) return null;

  const tier = normalizeTeacherPlanTier(profile.teacher_plan_tier, profile);
  return { tier, limits: getTeacherPlanLimits(cfg, tier) };
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

export async function assertTeacherCanBookSlot(
  teacherId: string,
  slotAt: Date
): Promise<{ ok: true; remaining: number } | { ok: false; error: string; code: string }> {
  const ctx = await loadTeacherPlanContext(teacherId);
  if (!ctx) return { ok: false, error: "Could not load plan", code: "plan_load_failed" };

  const booked = await countTeacherSlotsThisMonth(teacherId, slotAt);
  const quota = canBookMoreLiveClasses(booked, ctx.limits);
  if (!quota.allowed) {
    return {
      ok: false,
      error: liveClassQuotaExceededMessage(ctx.tier, quota.cap),
      code: "live_class_cap_reached",
    };
  }
  return { ok: true, remaining: quota.remaining - 1 };
}

export async function assertTeacherCanCreateAssignment(
  teacherId: string
): Promise<{ ok: true; remaining: number } | { ok: false; error: string; code: string }> {
  const ctx = await loadTeacherPlanContext(teacherId);
  if (!ctx) return { ok: false, error: "Could not load plan", code: "plan_load_failed" };

  const created = await countTeacherAssignmentsThisMonth(teacherId);
  const quota = canCreateMoreAssignments(created, ctx.limits);
  if (!quota.allowed) {
    return {
      ok: false,
      error: assignmentQuotaExceededMessage(ctx.tier, quota.cap),
      code: "assignment_cap_reached",
    };
  }
  return { ok: true, remaining: quota.remaining - 1 };
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
  return ctx ? teacherAssignmentPublishChargeWaived(ctx.tier) : false;
}
