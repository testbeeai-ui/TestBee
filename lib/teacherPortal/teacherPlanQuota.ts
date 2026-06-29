import { supabase } from "@/integrations/supabase/client";
import type { DbClient } from "@/lib/teacherPortal/queries/utils";
import {
  assignmentQuotaExceededMessage,
  canCreateMoreAssignments,
  fetchTeacherPlanConfig,
  getTeacherPlanLimits,
  istMonthBoundsForDate,
  normalizeTeacherPlanTier,
  type TeacherPlanKey,
} from "@/lib/teacherPortal/teacherPlan";

type ProfilePlanRow = {
  teacher_plan_tier?: string | null;
  teacher_plan_started_at?: string | null;
  teacher_plan_expires_at?: string | null;
  time_travel_offset_ms?: number | null;
};

export class TeacherPlanQuotaError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "TeacherPlanQuotaError";
    this.code = code;
  }
}

async function loadTeacherTier(
  teacherId: string,
  db: DbClient
): Promise<{ tier: TeacherPlanKey; limits: ReturnType<typeof getTeacherPlanLimits> }> {
  const [profileRes, cfg] = await Promise.all([
    db
      .from("profiles")
      .select(
        "teacher_plan_tier, teacher_plan_started_at, teacher_plan_expires_at, time_travel_offset_ms"
      )
      .eq("id", teacherId)
      .maybeSingle(),
    fetchTeacherPlanConfig(db),
  ]);

  const profile = profileRes.data as ProfilePlanRow | null;
  if (!profile) {
    throw new TeacherPlanQuotaError("Could not load plan", "plan_load_failed");
  }

  const tier = normalizeTeacherPlanTier(profile.teacher_plan_tier, profile);
  return { tier, limits: getTeacherPlanLimits(cfg, tier) };
}

export async function assertTeacherCanCreateAssignmentWithDb(
  teacherId: string,
  db?: DbClient
): Promise<void> {
  const client = db ?? supabase;
  const { tier, limits } = await loadTeacherTier(teacherId, client);

  const { start, end } = istMonthBoundsForDate(new Date());
  const { count } = await client
    .from("posts")
    .select("id", { count: "exact", head: true })
    .eq("teacher_id", teacherId)
    .eq("type", "assignment")
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString());

  const created = count ?? 0;
  const quota = canCreateMoreAssignments(created, limits);
  if (!quota.allowed) {
    throw new TeacherPlanQuotaError(
      assignmentQuotaExceededMessage(tier, quota.cap),
      "assignment_cap_reached"
    );
  }
}
