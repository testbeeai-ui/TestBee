import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { getIstWeekMondayDateString } from "@/lib/rdm/referral/referralIst";

type StudyDayRow = { active_ms: number | string | null };

/**
 * GET — aggregated profile stats for the “Attendance, assignments & study hours” grid.
 * Classes joined = classroom memberships; streak = profiles.daily_dose_streak (dual DailyDose);
 * mocks = mock_rdm_bonus_attempts rows; InstaCue = instacue dwell events this IST week;
 * study hours = sum of user_study_day_totals.active_ms;
 * assignments = rows in classroom_assignment_task_progress (each completed assignment task / checklist item).
 */
export async function GET(request: Request) {
  const auth = await getSupabaseAndUser(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { supabase, user } = auth;

  const monday = getIstWeekMondayDateString();
  const weekStartIso = `${monday}T00:00:00+05:30`;

  const [classroomsRes, assignmentsRes, profileRes, mocksRes, instacueRes, studyTotalsRes] =
    await Promise.all([
      supabase
        .from("classroom_members")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
      supabase
        .from("classroom_assignment_task_progress")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
      supabase.from("profiles").select("daily_dose_streak").eq("id", user.id).maybeSingle(),
      supabase
        .from("mock_rdm_bonus_attempts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
      supabase
        .from("student_learning_dwell_events")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("panel", "instacue")
        .gte("occurred_at", weekStartIso),
      supabase
        .from("user_study_day_totals" as never)
        .select("active_ms")
        .eq("user_id", user.id),
    ]);

  if (classroomsRes.error) {
    console.error("[profile-attendance-summary] classroom_members", classroomsRes.error.message);
  }
  if (assignmentsRes.error) {
    console.error(
      "[profile-attendance-summary] classroom_assignment_task_progress",
      assignmentsRes.error.message
    );
  }
  if (profileRes.error) {
    console.error("[profile-attendance-summary] profiles", profileRes.error.message);
  }
  if (mocksRes.error) {
    console.error("[profile-attendance-summary] mock_rdm_bonus_attempts", mocksRes.error.message);
  }
  if (instacueRes.error) {
    console.error(
      "[profile-attendance-summary] student_learning_dwell_events",
      instacueRes.error.message
    );
  }
  if (studyTotalsRes.error) {
    console.error(
      "[profile-attendance-summary] user_study_day_totals",
      studyTotalsRes.error.message
    );
  }

  let studyMsTotal = 0;
  if (!studyTotalsRes.error && Array.isArray(studyTotalsRes.data)) {
    for (const row of studyTotalsRes.data as StudyDayRow[]) {
      const ms = Number(row?.active_ms);
      if (Number.isFinite(ms) && ms > 0) studyMsTotal += ms;
    }
  }

  const profile = profileRes.data;

  return NextResponse.json({
    classroomsJoined: classroomsRes.error ? 0 : (classroomsRes.count ?? 0),
    assignmentTasksDone: assignmentsRes.error ? 0 : (assignmentsRes.count ?? 0),
    dailyDoseDualStreak: Math.max(0, Math.trunc(Number(profile?.daily_dose_streak) || 0)),
    mocksAttempted: mocksRes.error ? 0 : (mocksRes.count ?? 0),
    instacueDwellEventsThisWeek: instacueRes.error ? 0 : (instacueRes.count ?? 0),
    studyMsTotal,
  });
}
