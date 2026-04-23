import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { makeSubtopicEngagementStorageKey } from "@/lib/subtopicEngagementStorageKey";
import {
  parseTeacherProfileMetaFromBio,
  serializeTeacherProfileMetaToBio,
  type TeacherProfileDetails,
} from "@/lib/teacherProfileMeta";
import { appendQueryParams, buildTopicPath } from "@/lib/topicRoutes";
import { isValidLevel } from "@/lib/slugs";
import {
  buildDefaultTasksForAssignmentType,
  normalizeTaskPositions,
  parseAssignmentTasks,
  serializeTasksForContentJson,
  studentVisibleTasks,
  type AssignmentTaskStored,
} from "@/lib/classroom/assignmentTasks";
import {
  isDailyDoseStreakTrackId,
  playHrefForDailyDoseStreak,
  trackLabelById,
  type DailyDoseStreakTrackId,
} from "@/lib/teacherPortal/dailyDoseStreakTracks";
import type {
  TeacherPortalChapterQuizRef,
  TeacherPortalClassroomCard,
  TeacherPortalClassroomDetail,
  TeacherPortalDailyDoseStreakRef,
  TeacherPortalDataBundle,
  TeacherPortalGyanEngagementRef,
  TeacherPortalMockPaperRef,
  TeacherPortalMotivationLogItem,
  TeacherPortalProfileView,
  TeacherPortalReferStats,
  TeacherPortalSessionItem,
  TeacherPortalSummary,
  TeacherPortalWallItem,
} from "@/lib/teacherPortal/types";

function countStudentsAllVisibleTasksDone(
  studentUserIds: string[],
  visibleTasks: AssignmentTaskStored[],
  progressForPost: Array<{ task_id: string; user_id: string }>
): number {
  if (visibleTasks.length === 0 || studentUserIds.length === 0) return 0;
  return studentUserIds.filter((uid) =>
    visibleTasks.every((task) =>
      progressForPost.some((r) => r.user_id === uid && r.task_id === task.id)
    )
  ).length;
}

function ensureError(err: unknown): Error {
  if (err instanceof Error) return err;
  if (typeof err === "object" && err !== null && "message" in err) {
    const m = (err as { message: unknown }).message;
    if (typeof m === "string" && m.trim()) return new Error(m.trim());
  }
  if (typeof err === "string" && err.trim()) return new Error(err.trim());
  return new Error("Request failed");
}

const JOIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomJoinCode(): string {
  const c = globalThis.crypto;
  if (c?.getRandomValues) {
    const bytes = new Uint8Array(8);
    c.getRandomValues(bytes);
    let s = "";
    for (let i = 0; i < 8; i++) s += JOIN_CODE_ALPHABET[bytes[i]! % JOIN_CODE_ALPHABET.length];
    return s;
  }
  return Array.from(
    { length: 8 },
    () => JOIN_CODE_ALPHABET[Math.floor(Math.random() * JOIN_CODE_ALPHABET.length)]
  ).join("");
}

/** 8-char codes for student join; avoids collisions with a few retries. */
async function allocateUniqueJoinCode(): Promise<string> {
  for (let attempt = 0; attempt < 16; attempt++) {
    const code = randomJoinCode();
    const { data, error } = await supabase
      .from("classrooms")
      .select("id")
      .eq("join_code", code)
      .maybeSingle();
    if (error) continue;
    if (!data) return code;
  }
  throw new Error("Could not allocate a unique join code.");
}

function asObject(input: Json | null | undefined): Record<string, Json> {
  if (input && typeof input === "object" && !Array.isArray(input)) {
    return input as Record<string, Json>;
  }
  return {};
}

function asStringArray(input: Json | undefined): string[] {
  return Array.isArray(input)
    ? input.filter((item): item is string => typeof item === "string")
    : [];
}

function parseMockPaperRef(payload: Record<string, Json>): TeacherPortalMockPaperRef | null {
  const raw = payload.mockPaper;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id.trim() : "";
  const title = typeof o.title === "string" ? o.title.trim() : "";
  const slug = typeof o.slug === "string" ? o.slug.trim() : "";
  if (!id || !title) return null;
  return { id, title, slug: slug || id };
}

const SUBJECTS = new Set(["physics", "chemistry", "math"]);

function parseChapterQuizRef(payload: Record<string, Json>): TeacherPortalChapterQuizRef | null {
  const raw = payload.chapterQuiz;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const board = typeof o.board === "string" ? o.board.trim().toLowerCase() : "cbse";
  const subject = typeof o.subject === "string" ? o.subject.trim().toLowerCase() : "";
  if (!SUBJECTS.has(subject)) return null;
  const classLevel = Number(o.classLevel);
  if (classLevel !== 11 && classLevel !== 12) return null;
  const chapterTitle = typeof o.chapterTitle === "string" ? o.chapterTitle : "";
  const topic = typeof o.topic === "string" ? o.topic.trim() : "";
  const subtopicName = typeof o.subtopicName === "string" ? o.subtopicName.trim() : "";
  const levelRaw = typeof o.level === "string" ? o.level.trim().toLowerCase() : "";
  if (!topic || !subtopicName || !isValidLevel(levelRaw)) return null;
  const level = levelRaw;
  let advancedSet: 1 | 2 | 3 | undefined;
  if (level === "advanced") {
    const s = Number(o.advancedSet);
    if (s === 1 || s === 2 || s === 3) advancedSet = s;
    else advancedSet = 1;
  }
  return {
    board: board || "cbse",
    subject: subject as TeacherPortalChapterQuizRef["subject"],
    classLevel: classLevel as 11 | 12,
    chapterTitle,
    topic,
    subtopicName,
    level,
    ...(level === "advanced" ? { advancedSet } : {}),
  };
}

function parseDailyDoseStreakRef(
  payload: Record<string, Json>
): TeacherPortalDailyDoseStreakRef | null {
  const raw = payload.dailyDoseStreak;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const trackId = typeof o.trackId === "string" ? o.trackId.trim().toLowerCase() : "";
  if (!isDailyDoseStreakTrackId(trackId)) return null;
  const trackLabel = typeof o.trackLabel === "string" ? o.trackLabel.trim() : "";
  return { trackId, trackLabel: trackLabel || trackLabelById(trackId) };
}

function parseGyanEngagementRef(
  payload: Record<string, Json>
): TeacherPortalGyanEngagementRef | null {
  const raw = payload.gyanEngagement;
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const topicFocus = typeof o.topicFocus === "string" ? o.topicFocus.trim() : "";
  const subtopicHint = typeof o.subtopicHint === "string" ? o.subtopicHint.trim() : "";
  return { topicFocus, subtopicHint };
}

function formatSessionLabel(iso: string | null): string {
  if (!iso) return "No session scheduled";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "No session scheduled";
  const weekday = date.toLocaleDateString("en-US", { weekday: "short" });
  const day = date.toLocaleDateString("en-US", { day: "2-digit", month: "short" });
  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${weekday} ${day} · ${time}`;
}

function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function startOfWeekIso(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString();
}

/** Optional comma-separated classroom UUIDs (NEXT_PUBLIC_TEACHER_PORTAL_DEMO_CLASSROOM_IDS). */
function teacherPortalDemoClassroomIdsFromEnv(): string[] {
  const raw =
    typeof process !== "undefined" &&
    typeof process.env?.NEXT_PUBLIC_TEACHER_PORTAL_DEMO_CLASSROOM_IDS === "string"
      ? process.env.NEXT_PUBLIC_TEACHER_PORTAL_DEMO_CLASSROOM_IDS
      : "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** One designated “showcase” class keeps demo roster/banners; all other classes use real members only. */
export function isTeacherPortalDemoShowcaseClassroom(
  classroomId: string,
  classroomName: string | null
): boolean {
  if (teacherPortalDemoClassroomIdsFromEnv().includes(classroomId)) return true;
  return (classroomName ?? "").trim().toLowerCase() === "demo";
}

export async function loadTeacherPortalBundle(userId: string): Promise<TeacherPortalDataBundle> {
  const [
    profileRes,
    classroomsRes,
    membersRes,
    postsRes,
    sessionsRes,
    doubtsRes,
    answersRes,
    payoutsRes,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, name, avatar_url, bio, subjects, exam_tags, teaching_levels, visibility, rdm")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("classrooms")
      .select("id, name, subject, section, description, teacher_id, join_code")
      .eq("teacher_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("classroom_members")
      .select("classroom_id, role")
      .in(
        "classroom_id",
        (await supabase.from("classrooms").select("id").eq("teacher_id", userId)).data?.map(
          (c) => c.id
        ) ?? [""]
      ),
    supabase
      .from("posts")
      .select(
        "id, classroom_id, type, created_at, title, description, due_date, content_json, teacher_id"
      )
      .eq("teacher_id", userId),
    supabase
      .from("live_sessions")
      .select("id, classroom_id, title, scheduled_at, duration_minutes, meet_link, status")
      .eq("teacher_id", userId)
      .order("scheduled_at", { ascending: true }),
    supabase
      .from("doubts")
      .select("id, title, body, subject, created_at, upvotes, user_id")
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("doubt_answers")
      .select("id, doubt_id, body, user_id, upvotes, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("accepted_answer_payouts")
      .select("rdm_paid, paid_at")
      .eq("user_id", userId)
      .gte("paid_at", startOfWeekIso()),
  ]);

  const profile = profileRes.data;
  if (!profile) {
    throw new Error("Teacher profile not found.");
  }

  const classroomRowsRaw = classroomsRes.data ?? [];
  const classrooms: typeof classroomRowsRaw = [];
  for (const c of classroomRowsRaw) {
    if (c.join_code?.trim()) {
      classrooms.push(c);
      continue;
    }
    try {
      const join_code = await allocateUniqueJoinCode();
      const { error } = await supabase
        .from("classrooms")
        .update({ join_code })
        .eq("id", c.id)
        .eq("teacher_id", userId);
      if (error) {
        classrooms.push(c);
        continue;
      }
      classrooms.push({ ...c, join_code });
    } catch {
      classrooms.push(c);
    }
  }
  const classroomIds = classrooms.map((c) => c.id);

  const [memberRowsBase, postRows, sessionRows, askerProfilesRes] = await Promise.all([
    classroomIds.length
      ? supabase
          .from("classroom_members")
          .select("classroom_id, role")
          .in("classroom_id", classroomIds)
      : Promise.resolve({ data: [], error: null }),
    classroomIds.length
      ? supabase
          .from("posts")
          .select(
            "id, classroom_id, type, title, description, due_date, content_json, created_at, teacher_id"
          )
          .eq("teacher_id", userId)
          .in("classroom_id", classroomIds)
      : Promise.resolve({ data: [], error: null }),
    classroomIds.length
      ? supabase
          .from("live_sessions")
          .select("id, classroom_id, title, scheduled_at, duration_minutes, meet_link, status")
          .eq("teacher_id", userId)
          .in("classroom_id", classroomIds)
          .order("scheduled_at", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("profiles")
      .select("id, name, role")
      .in("id", [...new Set((doubtsRes.data ?? []).map((d) => d.user_id))]),
  ]);

  const members = memberRowsBase.data ?? membersRes.data ?? [];
  const posts = postRows.data ?? postsRes.data ?? [];
  const sessions = sessionRows.data ?? sessionsRes.data ?? [];
  const doubts = doubtsRes.data ?? [];
  const answers = answersRes.data ?? [];

  const memberCountMap = new Map<string, number>();
  members.forEach((m) => {
    const role = (m as { role?: string }).role;
    if (role === "teacher") return;
    memberCountMap.set(m.classroom_id, (memberCountMap.get(m.classroom_id) ?? 0) + 1);
  });

  const postCountMap = new Map<string, number>();
  posts.forEach((p) => {
    postCountMap.set(p.classroom_id, (postCountMap.get(p.classroom_id) ?? 0) + 1);
  });

  const nextSessionMap = new Map<string, string>();
  sessions.forEach((s) => {
    if (!nextSessionMap.has(s.classroom_id)) nextSessionMap.set(s.classroom_id, s.scheduled_at);
  });

  const classroomCards: TeacherPortalClassroomCard[] = classrooms.map((c) => {
    const studentCount = memberCountMap.get(c.id) ?? 0;
    const assignmentCount = postCountMap.get(c.id) ?? 0;
    const avgScorePercent: number | null = null;
    const isDemoShowcase = isTeacherPortalDemoShowcaseClassroom(c.id, c.name);
    return {
      id: c.id,
      name: c.name,
      subject: c.subject,
      section: c.section,
      description: c.description,
      joinCode: c.join_code,
      isDemoShowcase,
      studentCount,
      assignmentCount,
      avgScorePercent,
      nextSessionLabel: formatSessionLabel(nextSessionMap.get(c.id) ?? null),
      scheduleLabel: c.description?.includes("Repeat: ")
        ? (c.description.split("Repeat: ")[1]?.split(" | ")[0] ?? "Mon/Wed/Fri")
        : "Mon/Wed/Fri",
    };
  });

  const assignmentPosts = posts.filter(
    (p) =>
      p.type === "assignment" ||
      p.type === "quiz" ||
      p.type === "mock" ||
      p.type === "Concept Focus"
  );
  const classroomNameMap = new Map(classrooms.map((c) => [c.id, c.name]));
  const classroomMap = new Map(classrooms.map((c) => [c.id, c]));
  const assignmentByClassroom = new Map<string, ReturnType<typeof asObject>>();
  assignmentPosts.forEach((post) => {
    if (!assignmentByClassroom.has(post.classroom_id)) {
      assignmentByClassroom.set(post.classroom_id, asObject(post.content_json));
    }
  });

  const sessionPlanPosts = posts.filter((p) => p.type === "session_plan");
  const sessionItems: TeacherPortalSessionItem[] = sessions.map((s) => {
    const classroom = classroomMap.get(s.classroom_id);
    const assignmentPayload = assignmentByClassroom.get(s.classroom_id) ?? {};
    const matchedPlan = sessionPlanPosts
      .filter((p) => p.classroom_id === s.classroom_id)
      .sort((a, b) => {
        const at = a.created_at ? Date.parse(a.created_at) : 0;
        const bt = b.created_at ? Date.parse(b.created_at) : 0;
        return (Number.isFinite(bt) ? bt : 0) - (Number.isFinite(at) ? at : 0);
      })
      .find((p) => {
        if (p.title?.trim() === `${s.title} plan`) return true;
        const payload = asObject(p.content_json);
        const planScheduledAt =
          typeof payload.scheduledAt === "string" ? payload.scheduledAt.trim() : "";
        return planScheduledAt && planScheduledAt === s.scheduled_at;
      });

    const sessionPlanPayload = matchedPlan ? asObject(matchedPlan.content_json) : {};
    const normalizePreviewList = (value: unknown): string[] => {
      if (Array.isArray(value)) {
        return value
          .filter((v): v is string => typeof v === "string")
          .map((v) => v.trim())
          .filter(Boolean);
      }
      if (value && typeof value === "object") {
        const o = value as Record<string, unknown>;
        if (typeof o.label === "string" && o.label.trim()) return [o.label.trim()];
        if (typeof o.subtopicName === "string" && o.subtopicName.trim()) {
          return [`Concept Focus · ${o.subtopicName.trim()}`];
        }
        if (typeof o.topic === "string" && o.topic.trim()) {
          return [`Concept Focus · ${o.topic.trim()}`];
        }
      }
      if (typeof value === "string" && value.trim()) return [value.trim()];
      return [];
    };

    const preWorkMode =
      typeof sessionPlanPayload.preWorkMode === "string"
        ? sessionPlanPayload.preWorkMode.trim().toLowerCase()
        : "";

    const postWorkMode =
      typeof sessionPlanPayload.postWorkMode === "string"
        ? sessionPlanPayload.postWorkMode.trim().toLowerCase()
        : "";

    let preWork = normalizePreviewList(sessionPlanPayload.preWork);
    let postWork = normalizePreviewList(sessionPlanPayload.postWork);

    if (preWork.length === 0 && preWorkMode === "concept_focus") {
      preWork = normalizePreviewList(sessionPlanPayload.preWorkConceptRef);
    }
    if (postWork.length === 0 && postWorkMode === "concept_focus") {
      postWork = normalizePreviewList(sessionPlanPayload.postWorkConceptRef);
    }

    const resourcesRaw = Array.isArray(assignmentPayload.resources)
      ? assignmentPayload.resources
      : [];
    const resources = resourcesRaw
      .map((entry) => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
        const label = typeof entry.label === "string" ? entry.label : null;
        const href = typeof entry.href === "string" ? entry.href : null;
        if (!label) return null;
        return { label, href };
      })
      .filter((entry): entry is { label: string; href: string | null } => Boolean(entry));
    return {
      id: s.id,
      classroomId: s.classroom_id,
      classroomName: classroomNameMap.get(s.classroom_id) ?? "Classroom",
      title: s.title,
      scheduledAt: s.scheduled_at,
      durationMinutes: s.duration_minutes,
      meetLink: s.meet_link,
      studentCount: memberCountMap.get(s.classroom_id) ?? 0,
      status: s.status,
      isTrial: classroom?.description?.toLowerCase().includes("ad-hoc trial: enabled") ?? false,
      rewardRdm: typeof assignmentPayload.rewardRdm === "number" ? assignmentPayload.rewardRdm : 20,
      preWork: preWork.length ? preWork : ["Warm-up worksheet", "Revise previous class notes"],
      postWork: postWork.length
        ? postWork
        : ["DailyDose practice set", "Post class reflection in Gyan++"],
      resources: resources.length
        ? resources
        : [
            { label: "Class Notes PDF", href: null },
            { label: "Practice Worksheet", href: null },
          ],
    };
  });

  const memberProfilesRes = classroomIds.length
    ? await supabase
        .from("classroom_members")
        .select("classroom_id, user_id, role, joined_at, profiles(name, avatar_url, rdm)")
        .in("classroom_id", classroomIds)
    : { data: [], error: null };
  const anyDemoShowcaseClassroom = classrooms.some((c) =>
    isTeacherPortalDemoShowcaseClassroom(c.id, c.name)
  );
  const demoStudentsRes = anyDemoShowcaseClassroom
    ? await supabase
        .from("profiles")
        .select("id, name, avatar_url, rdm")
        .eq("role", "student")
        .limit(12)
    : { data: [], error: null };
  const memberRows =
    (memberProfilesRes.data as Array<{
      classroom_id: string;
      user_id: string;
      role: string;
      joined_at: string;
      profiles: { name: string; avatar_url: string | null; rdm: number | null } | null;
    }>) ?? [];

  const detailMap: Record<string, TeacherPortalClassroomDetail> = {};
  classroomIds.forEach((id) => {
    detailMap[id] = {
      classroomId: id,
      students: [],
      assignments: [],
      motivationLog: [],
      topStreakStudentIds: [],
    };
  });

  const studentRowIndexByClassroom = new Map<string, number>();
  memberRows.forEach((row) => {
    const detail = detailMap[row.classroom_id];
    if (!detail) return;
    if (row.role === "teacher") return;
    const classroomMeta = classrooms.find((c) => c.id === row.classroom_id);
    const demo = classroomMeta
      ? isTeacherPortalDemoShowcaseClassroom(classroomMeta.id, classroomMeta.name)
      : false;
    const idx = studentRowIndexByClassroom.get(row.classroom_id) ?? 0;
    studentRowIndexByClassroom.set(row.classroom_id, idx + 1);
    const avgScorePercent: number | null = null;
    const streakDays = demo ? (idx * 3 + 4) % 23 : 0;
    const status: "active" | "off_streak" | "at_risk" = demo
      ? streakDays < 3
        ? "off_streak"
        : "active"
      : "active";
    const lastActiveAt = demo
      ? new Date(Date.now() - ((idx % 6) * 18 + 4) * 60 * 60 * 1000).toISOString()
      : null;
    detail.students.push({
      userId: row.user_id,
      name: row.profiles?.name ?? "Student",
      avatarUrl: row.profiles?.avatar_url ?? null,
      joinedAt: row.joined_at,
      lastActiveAt,
      role: row.role,
      rdm: Number(row.profiles?.rdm ?? 0),
      avgScorePercent,
      streakDays,
      status,
    });
  });

  const demoStudents = (demoStudentsRes.data ?? []).filter((student) => student.id !== userId);
  classrooms.forEach((meta) => {
    if (!isTeacherPortalDemoShowcaseClassroom(meta.id, meta.name)) return;
    const detail = detailMap[meta.id];
    if (!detail) return;
    if (detail.students.length >= 4) return;
    const existingIds = new Set(detail.students.map((student) => student.userId));
    const needed = 4 - detail.students.length;
    const supplements = demoStudents
      .filter((student) => !existingIds.has(student.id))
      .slice(0, needed)
      .map((student, idx) => {
        const avgScorePercent: number | null = null;
        const streakDays = 4 + ((idx * 5) % 17);
        return {
          userId: student.id,
          name: student.name ?? "Student",
          avatarUrl: student.avatar_url ?? null,
          joinedAt: new Date(Date.now() - (idx + 10) * 86400000).toISOString(),
          lastActiveAt: new Date(Date.now() - (idx + 3) * 3600000).toISOString(),
          role: "student",
          rdm: Number(student.rdm ?? 0),
          avgScorePercent,
          streakDays,
          status: (streakDays < 5 ? "at_risk" : "active") as "active" | "off_streak" | "at_risk",
        };
      });
    detail.students.push(...supplements);
  });

  const assignmentPostIds = assignmentPosts.map((p) => p.id);
  let taskProgressRows: Array<{ post_id: string; task_id: string; user_id: string }> = [];
  if (assignmentPostIds.length > 0) {
    const { data: prog, error: progErr } = await supabase
      .from("classroom_assignment_task_progress")
      .select("post_id, task_id, user_id")
      .in("post_id", assignmentPostIds);
    if (!progErr && prog) taskProgressRows = prog as typeof taskProgressRows;
  }

  const studentIdsAcrossClassrooms = [
    ...new Set(
      Object.values(detailMap)
        .flatMap((d) => d.students)
        .filter((s) => s.role !== "teacher")
        .map((s) => s.userId)
    ),
  ];

  type ProfileEngagementRow = {
    id: string;
    subtopic_engagement: Json | null;
  };

  const studentEngagementByUser = new Map<string, Record<string, unknown>>();
  if (studentIdsAcrossClassrooms.length > 0) {
    const { data: profileRows, error: profileErr } = await supabase
      .from("profiles")
      .select("id, subtopic_engagement")
      .in("id", studentIdsAcrossClassrooms);

    if (!profileErr && profileRows) {
      for (const row of profileRows as ProfileEngagementRow[]) {
        const raw = row.subtopic_engagement;
        if (raw && typeof raw === "object" && !Array.isArray(raw)) {
          studentEngagementByUser.set(row.id, raw as Record<string, unknown>);
        } else {
          studentEngagementByUser.set(row.id, {});
        }
      }
    }
  }

  // Backfill chapter quiz completion from submitted attempts so teacher stats stay accurate
  // even when explicit task-progress rows are missing.
  if (assignmentPostIds.length > 0) {
    const genericSupabase = supabase as unknown as {
      from: (table: string) => {
        select: (columns: string) => {
          in: (
            column: string,
            values: string[]
          ) => {
            not: (
              column: string,
              operator: string,
              value: null
            ) => Promise<{
              data: Array<{ post_id: string; user_id: string; submitted_at: string }> | null;
              error: { message?: string } | null;
            }>;
          };
        };
      };
    };
    const { data: attempts, error: attemptsErr } = await genericSupabase
      .from("classroom_generated_test_attempts")
      .select("post_id, user_id, submitted_at")
      .in("post_id", assignmentPostIds)
      .not("submitted_at", "is", null);
    if (!attemptsErr && attempts) {
      const existing = new Set(
        taskProgressRows.map((r) => `${r.post_id}:${r.task_id}:${r.user_id}`)
      );
      const postById = new Map(assignmentPosts.map((p) => [p.id, p]));
      for (const attempt of attempts) {
        const post = postById.get(attempt.post_id);
        if (!post) continue;
        const chapterTaskIds = studentVisibleTasks(
          parseAssignmentTasks(post.content_json, post.type)
        )
          .filter((t) => t.kind === "chapter_quiz")
          .map((t) => t.id);
        for (const taskId of chapterTaskIds) {
          const key = `${attempt.post_id}:${taskId}:${attempt.user_id}`;
          if (existing.has(key)) continue;
          existing.add(key);
          taskProgressRows.push({
            post_id: attempt.post_id,
            task_id: taskId,
            user_id: attempt.user_id,
          });
        }
      }
    }
  }

  assignmentPosts.forEach((post, idx) => {
    const detail = detailMap[post.classroom_id];
    if (!detail) return;
    const payload = asObject(post.content_json);
    const dailyDoseStreak = parseDailyDoseStreakRef(payload);
    const gyanEngagement = parseGyanEngagementRef(payload);
    const studentMembers = detail.students.filter((s) => s.role !== "teacher");
    const studentIds = studentMembers.map((s) => s.userId);
    const total = Math.max(1, studentIds.length);
    const tasks = parseAssignmentTasks(post.content_json, post.type);
    const visible = studentVisibleTasks(tasks);
    const forPost = taskProgressRows.filter((r) => r.post_id === post.id);
    let completionPercent: number;
    let completedCount: number;
    if (visible.length > 0 && forPost.length >= 0) {
      completedCount = countStudentsAllVisibleTasksDone(studentIds, visible, forPost);
      const totalInstances = studentIds.length * visible.length;
      completionPercent =
        totalInstances > 0
          ? Math.round((100 * Math.min(forPost.length, totalInstances)) / totalInstances)
          : 0;
    } else {
      completionPercent = Math.max(22, Math.min(95, 35 + ((idx * 18) % 60)));
      completedCount = Math.round((completionPercent / 100) * total);
    }

    // Concept Focus: also count students who marked the matching subtopic as complete
    // in `profiles.subtopic_engagement.lessonChecklistMarkedCompleteAt`.
    if (post.type === "Concept Focus") {
      const chapterQuizRef = parseChapterQuizRef(payload);
      if (chapterQuizRef) {
        const completedByEngagement = new Set<string>();
        for (const uid of studentIds) {
          const store = studentEngagementByUser.get(uid);
          if (!store) continue;
          const key = makeSubtopicEngagementStorageKey({
            board: chapterQuizRef.board.toLowerCase() === "icse" ? "ICSE" : "CBSE",
            subject: chapterQuizRef.subject,
            classLevel: chapterQuizRef.classLevel,
            topic: chapterQuizRef.topic,
            subtopicName: chapterQuizRef.subtopicName,
            level: chapterQuizRef.level,
          });
          const snap = store[key];
          if (!snap || typeof snap !== "object" || Array.isArray(snap)) continue;
          const markedAt =
            typeof (snap as Record<string, unknown>).lessonChecklistMarkedCompleteAt === "string"
              ? String((snap as Record<string, unknown>).lessonChecklistMarkedCompleteAt).trim()
              : "";
          if (markedAt) completedByEngagement.add(uid);
        }

        if (completedByEngagement.size > 0) {
          completedCount = Math.max(completedCount, completedByEngagement.size);
          completionPercent =
            studentIds.length > 0
              ? Math.max(
                  completionPercent,
                  Math.round((100 * completedByEngagement.size) / studentIds.length)
                )
              : completionPercent;
        }
      }
    }
    const rewardRdm = typeof payload.rewardRdm === "number" ? payload.rewardRdm : 15;
    const instructions =
      typeof payload.instructions === "string"
        ? payload.instructions
        : (post.description ?? "No instructions");
    const assignedToLabel =
      typeof payload.assignToLabel === "string" ? payload.assignToLabel : `All ${total} students`;
    detail.assignments.push({
      id: post.id,
      title:
        post.title ||
        (post.type === "mock"
          ? "Full Physics Mock — JEE Pattern"
          : post.type === "quiz"
            ? "Electrostatics — Chapter Quiz"
            : post.type === "Concept Focus"
              ? "Concept Focus Assignment"
              : "DailyDose Streak — Week 3 Challenge"),
      type: post.type,
      dueDateIso: post.due_date,
      dueDateLabel: post.due_date ? formatSessionLabel(post.due_date) : "No due date",
      assignedToLabel,
      rewardRdm,
      instructions,
      completionPercent,
      completedCount,
      totalCount: total,
      tasks,
      ...(post.type === "mock" ? { mockPaper: parseMockPaperRef(payload) ?? null } : {}),
      ...(post.type === "quiz" || post.type === "Concept Focus"
        ? { chapterQuiz: parseChapterQuizRef(payload) ?? null }
        : {}),
      ...(dailyDoseStreak ? { dailyDoseStreak } : {}),
      ...(gyanEngagement ? { gyanEngagement } : {}),
    });
  });

  const motivationPosts = posts.filter((p) => p.type === "motivation");
  motivationPosts.forEach((post) => {
    const detail = detailMap[post.classroom_id];
    if (!detail) return;
    const payload = asObject(post.content_json);
    const actionKindRaw = payload.actionKind;
    const actionKind: TeacherPortalMotivationLogItem["actionKind"] =
      actionKindRaw === "boost" ||
      actionKindRaw === "nudge" ||
      actionKindRaw === "urgent_nudge" ||
      actionKindRaw === "reward_top_students"
        ? actionKindRaw
        : "boost";
    detail.motivationLog.push({
      id: post.id,
      classroomId: post.classroom_id,
      actionKind,
      message:
        typeof payload.message === "string" ? payload.message : (post.title ?? "Motivation action"),
      targetStudentIds: asStringArray(payload.targetStudentIds),
      rdmDelta: typeof payload.rdmDelta === "number" ? payload.rdmDelta : 0,
      createdAt: post.created_at ?? new Date().toISOString(),
      createdBy: post.teacher_id ?? userId,
    });
  });

  Object.values(detailMap).forEach((detail) => {
    const topStreakers = [...detail.students]
      .sort((a, b) => b.streakDays - a.streakDays)
      .slice(0, 3)
      .map((student) => student.userId);
    detail.topStreakStudentIds = topStreakers;
    detail.motivationLog.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  });

  const askerMap = new Map((askerProfilesRes.data ?? []).map((p) => [p.id, p]));
  const answersByDoubt = new Map<string, typeof answers>();
  answers.forEach((a) => {
    const list = answersByDoubt.get(a.doubt_id) ?? [];
    list.push(a);
    answersByDoubt.set(a.doubt_id, list);
  });

  const profileRowsRes = await supabase
    .from("profiles")
    .select("id, name, role")
    .in("id", [...new Set(answers.map((a) => a.user_id))]);
  const answerAuthorMap = new Map((profileRowsRes.data ?? []).map((p) => [p.id, p]));

  const wallItems: TeacherPortalWallItem[] = doubts.slice(0, 12).map((d) => {
    const list = answersByDoubt.get(d.id) ?? [];
    const aiAnswer = list.find((a) => answerAuthorMap.get(a.user_id)?.role === "ai") ?? null;
    const teacherAnswers = list.filter((a) => answerAuthorMap.get(a.user_id)?.role === "teacher");
    const myTeacherAnswers = teacherAnswers.filter((a) => a.user_id === userId);
    const latestMyTeacherAnswer = myTeacherAnswers.sort((a, b) =>
      (a.created_at ?? "") < (b.created_at ?? "") ? 1 : -1
    )[0];
    const preview =
      typeof latestMyTeacherAnswer?.body === "string"
        ? latestMyTeacherAnswer.body.replace(/\s+/g, " ").trim().slice(0, 180)
        : null;

    return {
      doubtId: d.id,
      title: d.title,
      body: d.body,
      subject: d.subject,
      createdAt: d.created_at,
      askerName: askerMap.get(d.user_id)?.name ?? "Student",
      askerRole: askerMap.get(d.user_id)?.role ?? null,
      upvotes: d.upvotes,
      peerCommentsCount: Math.max(0, list.length - (aiAnswer ? 1 : 0)),
      aiAnswerBody: aiAnswer?.body ?? null,
      teacherAnswersCount: teacherAnswers.length,
      hasTeacherAnswer: teacherAnswers.length > 0,
      hasCurrentTeacherAnswer: myTeacherAnswers.length > 0,
      currentTeacherAnswerPreview: preview && preview.length > 0 ? preview : null,
    };
  });

  const teacherAnswersByMe = answers.filter((a) => a.user_id === userId);
  const totalTeacherUpvotes = teacherAnswersByMe.reduce(
    (sum, row) => sum + Number(row.upvotes ?? 0),
    0
  );
  const avgTeacherUpvotes = teacherAnswersByMe.length
    ? Math.round(totalTeacherUpvotes / teacherAnswersByMe.length)
    : 0;

  const summary: TeacherPortalSummary = {
    activeClassrooms: classroomCards.length,
    totalStudents: classroomCards.reduce((sum, c) => sum + c.studentCount, 0),
    assignmentsActive: classroomCards.reduce((sum, c) => sum + c.assignmentCount, 0),
    avgCompletionPercent: null,
    rdmDistributedMonth: teacherAnswersByMe.length * 30,
    questionsToday: doubts.filter((d) => d.created_at >= startOfTodayIso()).length,
    teacherSectionsWritten: teacherAnswersByMe.length,
    teacherRdmWeek: (payoutsRes.data ?? []).reduce((sum, p) => sum + Number(p.rdm_paid ?? 0), 0),
    avgTeacherUpvotes,
  };

  const parsedProfileMeta = parseTeacherProfileMetaFromBio(profile.bio);

  const detailsFallback = parsedProfileMeta.details ?? {};

  type TeacherProfileDetailsRow = {
    teacher_id: string;
    location: string | null;
    qualification: string | null;
    experience: string | null;
    email: string | null;
    phone: string | null;
    youtube_or_social: string | null;
    aadhar_photo_url: string | null;
    aadhar_share_link: string | null;
    institute_certificate_photo_url: string | null;
    institute_certificate_share_link: string | null;
  };

  const { data: teacherDetailsRowRaw } = await (
    supabase as unknown as {
      from: (table: string) => {
        select: (columns: string) => {
          eq: (
            column: string,
            value: string
          ) => {
            maybeSingle: () => Promise<{
              data: TeacherProfileDetailsRow | null;
              error: { message?: string } | null;
            }>;
          };
        };
      };
    }
  )
    .from("teacher_profile_details")
    .select(
      "teacher_id, location, qualification, experience, email, phone, youtube_or_social, aadhar_photo_url, aadhar_share_link, institute_certificate_photo_url, institute_certificate_share_link"
    )
    .eq("teacher_id", profile.id)
    .maybeSingle();

  const tableDetails: TeacherProfileDetails | null = teacherDetailsRowRaw
    ? {
        location: teacherDetailsRowRaw.location ?? undefined,
        qualification: teacherDetailsRowRaw.qualification ?? undefined,
        experience: teacherDetailsRowRaw.experience ?? undefined,
        email: teacherDetailsRowRaw.email ?? undefined,
        phone: teacherDetailsRowRaw.phone ?? undefined,
        youtubeOrSocial: teacherDetailsRowRaw.youtube_or_social ?? undefined,
        docs: {
          aadharPhotoUrl: teacherDetailsRowRaw.aadhar_photo_url ?? undefined,
          aadharShareLink: teacherDetailsRowRaw.aadhar_share_link ?? undefined,
          instituteCertificatePhotoUrl:
            teacherDetailsRowRaw.institute_certificate_photo_url ?? undefined,
          instituteCertificateShareLink:
            teacherDetailsRowRaw.institute_certificate_share_link ?? undefined,
        },
      }
    : null;

  const details = tableDetails ?? detailsFallback;

  const profileView: TeacherPortalProfileView = {
    id: profile.id,
    name: profile.name,
    avatarUrl: profile.avatar_url,
    bio: parsedProfileMeta.studentBio || "",
    subjects: profile.subjects ?? [],
    examTags: profile.exam_tags ?? [],
    teachingLevels: profile.teaching_levels ?? [],
    visibility: profile.visibility,
    rdm: profile.rdm ?? 0,
    studentsHelped: summary.totalStudents,
    expertAnswers: summary.teacherSectionsWritten,
    avgUpvotes: summary.avgTeacherUpvotes,
    details: {
      location: details.location ?? null,
      qualification: details.qualification ?? null,
      experience: details.experience ?? null,
      email: details.email ?? null,
      phone: details.phone ?? null,
      youtubeOrSocial: details.youtubeOrSocial ?? null,
      docs: {
        aadharPhotoUrl: details.docs?.aadharPhotoUrl ?? null,
        aadharShareLink: details.docs?.aadharShareLink ?? null,
        instituteCertificatePhotoUrl: details.docs?.instituteCertificatePhotoUrl ?? null,
        instituteCertificateShareLink: details.docs?.instituteCertificateShareLink ?? null,
      },
    },
  };

  const referStats: TeacherPortalReferStats = {
    rdmBalance: profile.rdm ?? 0,
    referralLink: `edublast.in/teacher?ref=${profile.id.slice(0, 8).toUpperCase()}`,
    teachersReferred: 0,
    studentsReferred: 0,
    teacherRewardRdm: 100,
    studentRewardRdm: 50,
    teacherMilestoneBonusRdm: 300,
  };

  return {
    summary,
    classrooms: classroomCards,
    sessions: sessionItems,
    classroomDetails: detailMap,
    wallItems,
    profile: profileView,
    referStats,
  };
}

export async function postTeacherSection(input: {
  doubtId: string;
  teacherId: string;
  body: string;
}): Promise<void> {
  const trimmed = input.body.trim();
  if (!trimmed) throw new Error("Teacher section cannot be empty.");
  const { error } = await supabase.from("doubt_answers").insert({
    doubt_id: input.doubtId,
    user_id: input.teacherId,
    body: trimmed,
  });
  if (error) throw error;
}

export async function updateTeacherProfile(input: {
  userId: string;
  name: string;
  bio: string;
  visibility: string;
  subjects: string[];
  examTags: string[];
  teachingLevels: number[];
  details?: TeacherProfileDetails;
}): Promise<void> {
  const cleanSubjects = input.subjects.map((item) => item.trim()).filter(Boolean);
  const cleanExamTags = input.examTags.map((item) => item.trim()).filter(Boolean);
  const cleanLevels = input.teachingLevels
    .filter((value) => Number.isFinite(value))
    .map((value) => Math.trunc(value))
    .filter((value) => value > 0);

  // Keep backward-compatible encoded bio for student-facing text + legacy fallback details.
  const encodedBio = serializeTeacherProfileMetaToBio({
    studentBio: input.bio,
    details: input.details ?? {},
  });

  const { error } = await supabase
    .from("profiles")
    .update({
      name: input.name.trim(),
      bio: encodedBio.trim() || null,
      visibility: input.visibility,
      subjects: cleanSubjects,
      exam_tags: cleanExamTags,
      teaching_levels: cleanLevels,
    })
    .eq("id", input.userId);
  if (error) throw error;

  const d = input.details ?? {};
  const docs = d.docs ?? {};

  const detailsPayload = {
    teacher_id: input.userId,
    location: d.location?.trim() || null,
    qualification: d.qualification?.trim() || null,
    experience: d.experience?.trim() || null,
    email: d.email?.trim() || null,
    phone: d.phone?.trim() || null,
    youtube_or_social: d.youtubeOrSocial?.trim() || null,
    aadhar_photo_url: docs.aadharPhotoUrl?.trim() || null,
    aadhar_share_link: docs.aadharShareLink?.trim() || null,
    institute_certificate_photo_url: docs.instituteCertificatePhotoUrl?.trim() || null,
    institute_certificate_share_link: docs.instituteCertificateShareLink?.trim() || null,
  };

  const { error: detailsErr } = await (
    supabase as unknown as {
      from: (table: string) => {
        upsert: (
          values: Record<string, unknown>,
          options?: { onConflict?: string }
        ) => Promise<{ error: { message?: string } | null }>;
      };
    }
  )
    .from("teacher_profile_details")
    .upsert(detailsPayload, { onConflict: "teacher_id" });

  if (detailsErr) throw ensureError(detailsErr);
}

export async function createTeacherClassroom(input: {
  userId: string;
  name: string;
  subject: string;
  pucLevel: "PUC 1" | "PUC 2" | "Both";
  examTarget: string;
  scheduleDate: string | null;
  scheduleTime: string | null;
  durationMinutes: number;
  repeatDays: string[];
  allowAdhocTrial: boolean;
}): Promise<void> {
  const className = input.name.trim();
  if (!className) throw new Error("Classroom name is required.");

  const repeatText = input.repeatDays.length ? input.repeatDays.join(", ") : "No repeat selected";
  const scheduleText =
    input.scheduleDate && input.scheduleTime
      ? `${input.scheduleDate} ${input.scheduleTime} · ${input.durationMinutes} mins`
      : "Schedule not set";
  const notes = [
    `Exam target: ${input.examTarget}`,
    `Ad-hoc trial: ${input.allowAdhocTrial ? "Enabled" : "Disabled"}`,
    `Repeat: ${repeatText}`,
    `Schedule: ${scheduleText}`,
  ].join(" | ");

  const join_code = await allocateUniqueJoinCode();
  const { data: insertedClassroom, error: classErr } = await supabase
    .from("classrooms")
    .insert({
      teacher_id: input.userId,
      name: className,
      subject: input.subject,
      section: input.pucLevel,
      description: notes,
      type: "standard",
      join_code,
    })
    .select("id")
    .single();
  if (classErr) throw ensureError(classErr);

  const classroomId = insertedClassroom.id;
  const { error: membershipErr } = await supabase.from("classroom_members").insert({
    classroom_id: classroomId,
    user_id: input.userId,
    role: "teacher",
  });
  if (membershipErr && membershipErr.code !== "23505") throw ensureError(membershipErr);

  if (input.scheduleDate && input.scheduleTime) {
    const scheduledAt = new Date(`${input.scheduleDate}T${input.scheduleTime}:00`);
    if (!Number.isNaN(scheduledAt.getTime())) {
      const { error: sessionErr } = await supabase.from("live_sessions").insert({
        classroom_id: classroomId,
        teacher_id: input.userId,
        title: `${className} Session`,
        scheduled_at: scheduledAt.toISOString(),
        duration_minutes: input.durationMinutes,
        status: "scheduled",
      });
      if (sessionErr) throw ensureError(sessionErr);
    }
  }
}

export async function updateTeacherClassroom(input: {
  teacherId: string;
  classroomId: string;
  name: string;
  subject: string | null;
  section: string | null;
}): Promise<void> {
  const name = input.name.trim();
  if (!name) throw new Error("Classroom name is required.");
  const { error } = await supabase
    .from("classrooms")
    .update({
      name,
      subject: input.subject?.trim() || null,
      section: input.section?.trim() || null,
    })
    .eq("id", input.classroomId)
    .eq("teacher_id", input.teacherId);
  if (error) throw ensureError(error);
}

export async function deleteTeacherClassroom(input: {
  teacherId: string;
  classroomId: string;
}): Promise<void> {
  const { error } = await supabase
    .from("classrooms")
    .delete()
    .eq("id", input.classroomId)
    .eq("teacher_id", input.teacherId);
  if (error) throw ensureError(error);
}

export async function createClassroomAssignment(input: {
  teacherId: string;
  classroomId: string;
  assignmentType: string;
  title: string;
  dueDate: string | null;
  /** Optional exact due datetime (ISO) for timed publishing flows. */
  dueDateIso?: string | null;
  assignToLabel: string;
  rewardRdm: number;
  instructions: string;
  /** When empty, defaults are derived from assignment type label */
  tasks?: AssignmentTaskStored[];
  /** Selected catalog paper for `mock` assignments */
  mockPaper?: TeacherPortalMockPaperRef | null;
  /** Syllabus + subtopic scope for `quiz` assignments */
  chapterQuiz?: TeacherPortalChapterQuizRef | null;
  /** Funbrain streak lane for DailyDose-style assignments */
  dailyDoseStreak?: TeacherPortalDailyDoseStreakRef | null;
  /** Optional topic/subtopic hints for Gyan++ engagement assignments */
  gyanEngagement?: TeacherPortalGyanEngagementRef | null;
  /** Optional extra payload persisted inside content_json for custom assignment flows. */
  extraContentJson?: Record<string, Json> | null;
  /** Optional visibility override (default: classroom). */
  visibility?: string;
}): Promise<{ id: string }> {
  const title = input.title.trim();
  if (!title) throw new Error("Assignment title is required.");
  let taskList = normalizeTaskPositions(
    input.tasks?.length ? input.tasks : buildDefaultTasksForAssignmentType(input.assignmentType)
  );
  const mock = input.mockPaper;
  if (mock && input.assignmentType === "mock") {
    taskList = taskList.map((t) =>
      t.kind === "mock_paper"
        ? {
            ...t,
            label: mock.title,
            href: mock.slug ? `/mock?paper=${encodeURIComponent(mock.slug)}` : "/mock",
          }
        : t
    );
  }
  const ddIn = input.dailyDoseStreak;
  if (ddIn?.trackId && isDailyDoseStreakTrackId(ddIn.trackId.trim().toLowerCase())) {
    const tid = ddIn.trackId.trim().toLowerCase() as DailyDoseStreakTrackId;
    const lab = (ddIn.trackLabel ?? "").trim() || trackLabelById(tid);
    const href = playHrefForDailyDoseStreak(tid);
    taskList = taskList.map((t) =>
      t.kind === "daily_dose" ? { ...t, label: `Streak challenge — ${lab}`, href } : t
    );
  }

  const geIn = input.gyanEngagement;
  if (geIn) {
    const topic = (geIn.topicFocus ?? "").trim();
    const sub = (geIn.subtopicHint ?? "").trim();
    const focus = sub || topic || "today’s class topic";
    const href = "/doubts?ask=1";
    taskList = taskList.map((t) =>
      t.kind === "gyan_engagement" ? { ...t, label: `Gyan++ — post a doubt on: ${focus}`, href } : t
    );
  }

  const cq = input.chapterQuiz;
  if (cq && (input.assignmentType === "quiz" || input.assignmentType === "Concept Focus")) {
    const path = buildTopicPath(
      cq.board,
      cq.subject,
      cq.classLevel,
      cq.topic,
      cq.subtopicName,
      cq.level,
      undefined,
      cq.chapterTitle.trim() ? cq.chapterTitle : undefined
    );
    const extra: Record<string, string> = {
      panel: "quiz",
      postId: "{{POST_ID}}",
      classroomId: input.classroomId,
    };
    if (cq.level === "advanced" && cq.advancedSet) extra.quizSet = String(cq.advancedSet);
    const href = appendQueryParams(path, extra);
    const setSuffix = cq.level === "advanced" && cq.advancedSet ? ` · Set ${cq.advancedSet}` : "";

    taskList = taskList.map((t) => {
      if (t.kind === "chapter_quiz") {
        return {
          ...t,
          label:
            input.assignmentType === "Concept Focus"
              ? `Quiz on ${cq.subtopicName}`
              : `Chapter quiz: ${cq.subtopicName}${setSuffix}`,
          href,
        };
      }
      if (t.kind === "topic_path" && input.assignmentType === "Concept Focus") {
        return {
          ...t,
          label: `Theory: ${cq.subtopicName}`,
          href: appendQueryParams(path, { ...extra, panel: "theory" }),
        };
      }
      if (t.kind === "instacue" && input.assignmentType === "Concept Focus") {
        return {
          ...t,
          label: `InstaCue Cards: ${cq.subtopicName}`,
          href: appendQueryParams(path, { ...extra, panel: "instacue" }),
        };
      }
      if (t.kind === "bits" && input.assignmentType === "Concept Focus") {
        return {
          ...t,
          label: `Numerals Practice: ${cq.subtopicName}`,
          href: appendQueryParams(path, { ...extra, panel: "numerals" }),
        };
      }
      return t;
    });
  }
  const preWork = taskList.filter((t) => t.visible_to_student).map((t) => t.label);
  const baseContentJson: Record<string, Json> = {
    assignToLabel: input.assignToLabel,
    rewardRdm: input.rewardRdm,
    instructions: input.instructions.trim() || "",
    tasks: serializeTasksForContentJson(taskList),
    mockPaper: mock ? { id: mock.id, slug: mock.slug, title: mock.title } : null,
    chapterQuiz: cq
      ? {
          board: cq.board,
          subject: cq.subject,
          classLevel: cq.classLevel,
          chapterTitle: cq.chapterTitle,
          topic: cq.topic,
          subtopicName: cq.subtopicName,
          level: cq.level,
          ...(cq.level === "advanced" && cq.advancedSet ? { advancedSet: cq.advancedSet } : {}),
        }
      : null,
    dailyDoseStreak:
      ddIn?.trackId && isDailyDoseStreakTrackId(ddIn.trackId.trim().toLowerCase())
        ? {
            trackId: ddIn.trackId.trim().toLowerCase(),
            trackLabel:
              (ddIn.trackLabel ?? "").trim() ||
              trackLabelById(ddIn.trackId.trim().toLowerCase() as DailyDoseStreakTrackId),
          }
        : null,
    gyanEngagement: geIn
      ? {
          topicFocus: (geIn.topicFocus ?? "").trim(),
          subtopicHint: (geIn.subtopicHint ?? "").trim(),
        }
      : null,
    preWork: preWork.length ? preWork : ["Revise previous class notes", "Attempt 5 warm-up MCQs"],
    postWork: ["Submit revision reflection", "Attempt DailyDose challenge"],
    resources: [
      { label: "Revision Sheet", href: null },
      { label: "Reference Video", href: null },
    ],
  };
  const mergedContentJson: Json = {
    ...baseContentJson,
    ...(input.extraContentJson ?? {}),
  };
  const dueDateIso =
    typeof input.dueDateIso === "string" && input.dueDateIso.trim()
      ? input.dueDateIso.trim()
      : input.dueDate
        ? new Date(`${input.dueDate}T23:59:00`).toISOString()
        : null;

  const { data: insertedPost, error } = await supabase
    .from("posts")
    .insert({
      classroom_id: input.classroomId,
      teacher_id: input.teacherId,
      title,
      type: input.assignmentType,
      visibility: input.visibility?.trim() || "classroom",
      description: `Assign to: ${input.assignToLabel} | Reward: +${input.rewardRdm} RDM | Notes: ${input.instructions.trim() || "None"}`,
      due_date: dueDateIso,
      content_json: mergedContentJson,
    })
    .select("id, content_json")
    .single();
  if (error) throw error;

  // Allow task links like "/classroom/{id}/assignment-test/{{POST_ID}}" by resolving after insert.
  const rawTasks = Array.isArray(baseContentJson.tasks) ? baseContentJson.tasks : [];
  const hasPostTemplate = rawTasks.some((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
    const href = (entry as Record<string, unknown>).href;
    return typeof href === "string" && href.includes("{{POST_ID}}");
  });
  if (hasPostTemplate && insertedPost) {
    const existing =
      insertedPost.content_json && typeof insertedPost.content_json === "object"
        ? (insertedPost.content_json as Record<string, Json>)
        : {};
    const existingTasks = Array.isArray(existing.tasks) ? existing.tasks : [];
    const resolvedTasks = existingTasks.map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return entry;
      const task = { ...(entry as Record<string, Json>) };
      const href = task.href;
      if (typeof href === "string" && href.includes("{{POST_ID}}")) {
        task.href = href.replaceAll("{{POST_ID}}", insertedPost.id);
      }
      return task;
    });
    const { error: updateErr } = await supabase
      .from("posts")
      .update({
        content_json: {
          ...existing,
          tasks: resolvedTasks,
        },
      })
      .eq("id", insertedPost.id)
      .eq("teacher_id", input.teacherId);
    if (updateErr) throw updateErr;
    return { id: insertedPost.id };
  }

  return { id: insertedPost.id };
}

export async function createMotivationAction(input: {
  teacherId: string;
  classroomId: string;
  actionKind: "boost" | "nudge" | "urgent_nudge";
  targetStudentIds: string[];
  message: string;
  rdmDelta: number;
}): Promise<void> {
  const { error } = await supabase.from("posts").insert({
    classroom_id: input.classroomId,
    teacher_id: input.teacherId,
    type: "motivation",
    title: input.message.trim() || "Motivation action",
    visibility: "classroom",
    description: `${input.actionKind} sent to ${input.targetStudentIds.length} student(s)`,
    content_json: {
      actionKind: input.actionKind,
      message: input.message.trim() || "Keep going!",
      targetStudentIds: input.targetStudentIds,
      rdmDelta: input.rdmDelta,
    },
  });
  if (error) throw error;
}

export async function createRewardTopStudentsAction(input: {
  teacherId: string;
  classroomId: string;
  targetStudentIds: string[];
  message: string;
  rdmDelta: number;
}): Promise<void> {
  const { error } = await supabase.from("posts").insert({
    classroom_id: input.classroomId,
    teacher_id: input.teacherId,
    type: "motivation",
    title: input.message.trim() || "Rewarded top tier students",
    visibility: "classroom",
    description: `reward_top_students sent to ${input.targetStudentIds.length} student(s)`,
    content_json: {
      actionKind: "reward_top_students",
      message: input.message.trim() || "Rewarding your consistency and hard work!",
      targetStudentIds: input.targetStudentIds,
      rdmDelta: input.rdmDelta,
    },
  });
  if (error) throw error;
}

export async function listMotivationLogForClassroom(
  classroomId: string
): Promise<TeacherPortalMotivationLogItem[]> {
  const { data, error } = await supabase
    .from("posts")
    .select("id, classroom_id, teacher_id, type, title, created_at, content_json")
    .eq("classroom_id", classroomId)
    .eq("type", "motivation")
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row) => {
    const payload = asObject(row.content_json);
    const actionKindRaw = payload.actionKind;
    const actionKind: TeacherPortalMotivationLogItem["actionKind"] =
      actionKindRaw === "boost" ||
      actionKindRaw === "nudge" ||
      actionKindRaw === "urgent_nudge" ||
      actionKindRaw === "reward_top_students"
        ? actionKindRaw
        : "boost";
    return {
      id: row.id,
      classroomId: row.classroom_id,
      actionKind,
      message:
        typeof payload.message === "string" ? payload.message : (row.title ?? "Motivation action"),
      targetStudentIds: asStringArray(payload.targetStudentIds),
      rdmDelta: typeof payload.rdmDelta === "number" ? payload.rdmDelta : 0,
      createdAt: row.created_at,
      createdBy: row.teacher_id,
    };
  });
}

export async function createTeacherLiveSession(input: {
  teacherId: string;
  classroomId: string;
  title: string;
  date: string;
  startTime: string;
  durationMinutes: number;
  meetLink: string;
  allowAdhocTrial: boolean;
  preWork: string;
  postWork: string;
  preWorkMode?: "custom" | "concept_focus";
  preWorkConceptRef?: {
    board: string;
    subject: "physics" | "chemistry" | "math";
    classLevel: 11 | 12;
    chapterTitle: string;
    topic: string;
    subtopicName: string;
    level: "basics" | "intermediate" | "advanced";
    advancedSet?: 1 | 2 | 3;
  } | null;
  postWorkMode?: "custom" | "concept_focus";
  postWorkConceptRef?: {
    board: string;
    subject: "physics" | "chemistry" | "math";
    classLevel: 11 | 12;
    chapterTitle: string;
    topic: string;
    subtopicName: string;
    level: "basics" | "intermediate" | "advanced";
    advancedSet?: 1 | 2 | 3;
  } | null;
  postWorkDelayDays?: number;
}): Promise<void> {
  const sessionTitle = input.title.trim();
  if (!sessionTitle) throw new Error("Session topic is required.");
  if (!input.classroomId) throw new Error("Classroom is required.");
  if (!input.date || !input.startTime) throw new Error("Date and start time are required.");
  const meetLinkRaw = input.meetLink.trim();
  if (!meetLinkRaw) throw new Error("Google Meet link is required.");
  const meetLink =
    /^https?:\/\//i.test(meetLinkRaw) || meetLinkRaw.startsWith("mailto:")
      ? meetLinkRaw
      : `https://${meetLinkRaw}`;

  const scheduledAt = new Date(`${input.date}T${input.startTime}:00`);
  if (Number.isNaN(scheduledAt.getTime())) throw new Error("Invalid session date/time.");

  const { error: sessionError } = await supabase.from("live_sessions").insert({
    classroom_id: input.classroomId,
    teacher_id: input.teacherId,
    title: sessionTitle,
    scheduled_at: scheduledAt.toISOString(),
    duration_minutes: input.durationMinutes,
    meet_link: meetLink,
    status: "scheduled",
  });
  if (sessionError) throw ensureError(sessionError);

  const preWorkPreview =
    (input.preWorkMode ?? "custom") === "concept_focus" && input.preWorkConceptRef
      ? [`Concept Focus · ${input.preWorkConceptRef.subtopicName}`]
      : [input.preWork.trim()].filter(Boolean);

  const postWorkPreview =
    (input.postWorkMode ?? "custom") === "concept_focus" && input.postWorkConceptRef
      ? [`Concept Focus · ${input.postWorkConceptRef.subtopicName}`]
      : [input.postWork.trim()].filter(Boolean);

  const { error: planError } = await supabase.from("posts").insert({
    classroom_id: input.classroomId,
    teacher_id: input.teacherId,
    type: "session_plan",
    title: `${sessionTitle} plan`,
    visibility: "classroom",
    description: `Adhoc trial: ${input.allowAdhocTrial ? "Enabled" : "Disabled"}`,
    content_json: {
      preWork: preWorkPreview,
      postWork: postWorkPreview,
      preWorkMode: input.preWorkMode ?? "custom",
      postWorkMode: input.postWorkMode ?? "custom",
      preWorkConceptRef: input.preWorkConceptRef ?? null,
      postWorkConceptRef: input.postWorkConceptRef ?? null,
      postWorkDelayDays:
        Number.isFinite(Number(input.postWorkDelayDays)) && Number(input.postWorkDelayDays) >= 0
          ? Math.floor(Number(input.postWorkDelayDays))
          : 0,
      allowAdhocTrial: input.allowAdhocTrial,
      scheduledAt: scheduledAt.toISOString(),
      durationMinutes: input.durationMinutes,
    },
  });
  if (planError) throw ensureError(planError);

  const sessionEnd = new Date(scheduledAt.getTime() + input.durationMinutes * 60 * 1000);
  const preReleaseAt = new Date().toISOString();
  const postDelayDays =
    Number.isFinite(Number(input.postWorkDelayDays)) && Number(input.postWorkDelayDays) >= 0
      ? Math.floor(Number(input.postWorkDelayDays))
      : 0;
  const postReleaseAt = new Date(
    sessionEnd.getTime() + postDelayDays * 24 * 60 * 60 * 1000 + 1000
  ).toISOString();

  // Auto-create PRE-WORK assignment (immediate release, deadline = class start).
  if ((input.preWorkMode ?? "custom") === "concept_focus" && input.preWorkConceptRef) {
    const cq = input.preWorkConceptRef;
    await createClassroomAssignment({
      teacherId: input.teacherId,
      classroomId: input.classroomId,
      assignmentType: "Concept Focus",
      title: `${sessionTitle} · Pre-work`,
      dueDate: null,
      dueDateIso: scheduledAt.toISOString(),
      assignToLabel: "All students",
      rewardRdm: 15,
      instructions: input.preWork.trim() || "Complete concept-focus pre-work before class starts.",
      chapterQuiz: {
        board: cq.board,
        subject: cq.subject,
        classLevel: cq.classLevel,
        chapterTitle: cq.chapterTitle,
        topic: cq.topic,
        subtopicName: cq.subtopicName,
        level: cq.level,
        ...(cq.level === "advanced" && cq.advancedSet ? { advancedSet: cq.advancedSet } : {}),
      },
      extraContentJson: {
        releaseAt: preReleaseAt,
        autoScheduledFromSession: true,
        sessionPhase: "pre_work",
        sessionTitle,
        sessionScheduledAt: scheduledAt.toISOString(),
        sessionDurationMinutes: input.durationMinutes,
      },
    });
  } else if (input.preWork.trim()) {
    await createClassroomAssignment({
      teacherId: input.teacherId,
      classroomId: input.classroomId,
      assignmentType: "assignment",
      title: `${sessionTitle} · Pre-work`,
      dueDate: null,
      dueDateIso: scheduledAt.toISOString(),
      assignToLabel: "All students",
      rewardRdm: 10,
      instructions: input.preWork.trim(),
      extraContentJson: {
        releaseAt: preReleaseAt,
        autoScheduledFromSession: true,
        sessionPhase: "pre_work",
        sessionTitle,
        sessionScheduledAt: scheduledAt.toISOString(),
        sessionDurationMinutes: input.durationMinutes,
      },
    });
  }

  // Auto-create POST-WORK assignment (released after class end + optional day delay).
  if ((input.postWorkMode ?? "custom") === "concept_focus" && input.postWorkConceptRef) {
    const cq = input.postWorkConceptRef;
    const postDueAt = new Date(postReleaseAt).toISOString();
    await createClassroomAssignment({
      teacherId: input.teacherId,
      classroomId: input.classroomId,
      assignmentType: "Concept Focus",
      title: `${sessionTitle} · Post-work`,
      dueDate: null,
      dueDateIso: postDueAt,
      assignToLabel: "All students",
      rewardRdm: 15,
      instructions:
        input.postWork.trim() || "Complete this concept-focus post-work after class completion.",
      chapterQuiz: {
        board: cq.board,
        subject: cq.subject,
        classLevel: cq.classLevel,
        chapterTitle: cq.chapterTitle,
        topic: cq.topic,
        subtopicName: cq.subtopicName,
        level: cq.level,
        ...(cq.level === "advanced" && cq.advancedSet ? { advancedSet: cq.advancedSet } : {}),
      },
      extraContentJson: {
        releaseAt: postReleaseAt,
        autoScheduledFromSession: true,
        sessionPhase: "post_work",
        sessionTitle,
        postWorkDelayDays: postDelayDays,
        sessionScheduledAt: scheduledAt.toISOString(),
        sessionDurationMinutes: input.durationMinutes,
      },
    });
  } else if (input.postWork.trim()) {
    const postDueAt = new Date(postReleaseAt).toISOString();
    await createClassroomAssignment({
      teacherId: input.teacherId,
      classroomId: input.classroomId,
      assignmentType: "assignment",
      title: `${sessionTitle} · Post-work`,
      dueDate: null,
      dueDateIso: postDueAt,
      assignToLabel: "All students",
      rewardRdm: 10,
      instructions: input.postWork.trim(),
      extraContentJson: {
        releaseAt: postReleaseAt,
        autoScheduledFromSession: true,
        sessionPhase: "post_work",
        sessionTitle,
        postWorkDelayDays: postDelayDays,
        sessionScheduledAt: scheduledAt.toISOString(),
        sessionDurationMinutes: input.durationMinutes,
      },
    });
  }
}
