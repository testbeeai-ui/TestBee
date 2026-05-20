import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { isAdminUser } from "@/lib/admin/admin";
import { createAdminClient } from "@/integrations/supabase/server";

type TeacherDirectoryRow = {
  id: string;
  name: string | null;
  email: string | null;
  subjects: string[];
  teachingLevels: number[];
  googleConnected: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  classrooms: number;
  sections: number;
  assignments: number;
  upcomingSessions: number;
};

type Summary = {
  totalTeachers: number;
  activeTeachers30d: number;
  googleConnectedTeachers: number;
  classroomsTotal: number;
  sectionsTotal: number;
  assignmentsTotal: number;
  upcomingSessionsTotal: number;
  motivationActionsTotal: number;
  generatedAt: string;
};

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((x): x is string => typeof x === "string") : [];
}

function asNumberArray(value: unknown): number[] {
  return Array.isArray(value) ? value.map((x) => Number(x)).filter((n) => Number.isFinite(n)) : [];
}

export async function GET(request: Request) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdminUser(ctx.supabase, ctx.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 500 });
    }

    const url = new URL(request.url);
    const mode = (url.searchParams.get("mode") ?? "directory").trim();
    const filter = (url.searchParams.get("filter") ?? "").trim();
    const search = (url.searchParams.get("search") ?? "").trim().toLowerCase();

    const profilesRes = await admin
      .from("profiles")
      .select(
        "id, name, role, subjects, teaching_levels, google_connected, created_at, updated_at"
      )
      .eq("role", "teacher")
      .order("created_at", { ascending: false })
      .limit(5000);
    if (profilesRes.error) {
      return NextResponse.json({ error: profilesRes.error.message }, { status: 500 });
    }
    const profiles = (profilesRes.data ?? []) as Array<{
      id: string;
      name: string | null;
      role: string | null;
      subjects: unknown;
      teaching_levels: unknown;
      google_connected?: boolean | null;
      created_at?: string | null;
      updated_at?: string | null;
    }>;

    const teacherIds = profiles.map((p) => p.id);
    const now = Date.now();
    const thirtyDaysAgoMs = now - 30 * 24 * 60 * 60 * 1000;

    const [classroomsRes, postsRes, sessionsRes] = await Promise.all([
      teacherIds.length
        ? (admin as any)
            .from("classrooms")
            .select("id, teacher_id")
            .in("teacher_id", teacherIds)
        : Promise.resolve({ data: [], error: null }),
      teacherIds.length
        ? admin
            .from("posts")
            .select("id, teacher_id, type, created_at")
            .in("teacher_id", teacherIds)
        : Promise.resolve({ data: [], error: null }),
      teacherIds.length
        ? admin
            .from("live_sessions")
            .select("id, teacher_id, scheduled_at, status")
            .in("teacher_id", teacherIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (classroomsRes.error)
      return NextResponse.json({ error: classroomsRes.error.message }, { status: 500 });
    if (postsRes.error) return NextResponse.json({ error: postsRes.error.message }, { status: 500 });
    if (sessionsRes.error)
      return NextResponse.json({ error: sessionsRes.error.message }, { status: 500 });

    const classroomRows = (classroomsRes.data ?? []) as Array<{ id: string; teacher_id: string }>;
    const postsRows = (postsRes.data ?? []) as Array<{
      id: string;
      teacher_id: string;
      type: string | null;
      created_at: string | null;
    }>;
    const sessionsRows = (sessionsRes.data ?? []) as Array<{
      id: string;
      teacher_id: string;
      scheduled_at: string;
      status: string | null;
    }>;

    const classroomIds = classroomRows.map((c) => c.id);
    const sectionsRes = classroomIds.length
      ? (admin as any)
          .from("classroom_sections")
          .select("id, classroom_id")
          .in("classroom_id", classroomIds)
      : { data: [], error: null };
    if ((sectionsRes as any).error) {
      return NextResponse.json({ error: (sectionsRes as any).error.message }, { status: 500 });
    }
    const sectionRows = ((sectionsRes as any).data ?? []) as Array<{
      id: string;
      classroom_id: string;
    }>;

    const classroomCountByTeacher = new Map<string, number>();
    const sectionsCountByTeacher = new Map<string, number>();
    const assignmentsCountByTeacher = new Map<string, number>();
    const motivationCountByTeacher = new Map<string, number>();
    const upcomingSessionsByTeacher = new Map<string, number>();

    const teacherIdByClassroomId = new Map<string, string>();
    for (const c of classroomRows) {
      teacherIdByClassroomId.set(c.id, c.teacher_id);
      classroomCountByTeacher.set(c.teacher_id, (classroomCountByTeacher.get(c.teacher_id) ?? 0) + 1);
    }
    for (const s of sectionRows) {
      const tid = teacherIdByClassroomId.get(s.classroom_id);
      if (!tid) continue;
      sectionsCountByTeacher.set(tid, (sectionsCountByTeacher.get(tid) ?? 0) + 1);
    }

    const assignmentTypes = new Set(["assignment", "quiz", "mock", "Concept Focus"]);
    for (const p of postsRows) {
      if (assignmentTypes.has(String(p.type ?? ""))) {
        assignmentsCountByTeacher.set(
          p.teacher_id,
          (assignmentsCountByTeacher.get(p.teacher_id) ?? 0) + 1
        );
      }
      if (String(p.type ?? "") === "motivation") {
        motivationCountByTeacher.set(
          p.teacher_id,
          (motivationCountByTeacher.get(p.teacher_id) ?? 0) + 1
        );
      }
    }

    const cancelled = (st: string | null) => {
      const v = (st ?? "").trim().toLowerCase();
      return v === "cancelled" || v === "canceled";
    };
    for (const s of sessionsRows) {
      if (cancelled(s.status)) continue;
      const start = Date.parse(s.scheduled_at);
      if (!Number.isFinite(start)) continue;
      if (start < now) continue;
      upcomingSessionsByTeacher.set(
        s.teacher_id,
        (upcomingSessionsByTeacher.get(s.teacher_id) ?? 0) + 1
      );
    }

    const directory: TeacherDirectoryRow[] = profiles.map((p) => {
      const classrooms = classroomCountByTeacher.get(p.id) ?? 0;
      const sections = sectionsCountByTeacher.get(p.id) ?? 0;
      const assignments = assignmentsCountByTeacher.get(p.id) ?? 0;
      const upcomingSessions = upcomingSessionsByTeacher.get(p.id) ?? 0;
      return {
        id: p.id,
        name: p.name ?? null,
        email: null,
        subjects: asStringArray(p.subjects),
        teachingLevels: asNumberArray(p.teaching_levels),
        googleConnected: Boolean(p.google_connected),
        createdAt: p.created_at ?? null,
        updatedAt: p.updated_at ?? p.created_at ?? null,
        classrooms,
        sections,
        assignments,
        upcomingSessions,
      };
    });

    const filtered = directory.filter((row) => {
      if (search) {
        const hay = `${row.name ?? ""} ${row.email ?? ""} ${row.id}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      if (filter === "active30d") {
        const ts = Date.parse(row.updatedAt ?? row.createdAt ?? "");
        if (!Number.isFinite(ts) || ts < thirtyDaysAgoMs) return false;
      }
      if (filter === "upcomingSessions" && row.upcomingSessions <= 0) return false;
      if (filter === "googleConnected" && !row.googleConnected) return false;
      return true;
    });

    if (mode === "summary") {
      const totalTeachers = directory.length;
      const activeTeachers30d = directory.filter((r) => {
        const ts = Date.parse(r.updatedAt ?? r.createdAt ?? "");
        return Number.isFinite(ts) && ts >= thirtyDaysAgoMs;
      }).length;
      const googleConnectedTeachers = directory.filter((r) => r.googleConnected).length;
      const classroomsTotal = Array.from(classroomCountByTeacher.values()).reduce((a, b) => a + b, 0);
      const sectionsTotal = Array.from(sectionsCountByTeacher.values()).reduce((a, b) => a + b, 0);
      const assignmentsTotal = Array.from(assignmentsCountByTeacher.values()).reduce((a, b) => a + b, 0);
      const upcomingSessionsTotal = Array.from(upcomingSessionsByTeacher.values()).reduce((a, b) => a + b, 0);
      const motivationActionsTotal = Array.from(motivationCountByTeacher.values()).reduce((a, b) => a + b, 0);

      const summary: Summary = {
        totalTeachers,
        activeTeachers30d,
        googleConnectedTeachers,
        classroomsTotal,
        sectionsTotal,
        assignmentsTotal,
        upcomingSessionsTotal,
        motivationActionsTotal,
        generatedAt: new Date().toISOString(),
      };
      return NextResponse.json({ summary });
    }

    return NextResponse.json({
      teachers: mode === "directory" ? filtered : directory,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

