import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
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
import {
  formatConceptFocusRefForDisplay,
  inferSessionWorkKind,
  postWorkDelayLabel,
} from "@/lib/teacherPortal/sessionWorkDisplay";
import type {
  TeacherPortalChapterQuizRef,
  TeacherPortalClassroomCard,
  TeacherPortalClassroomDetail,
  TeacherPortalDailyDoseStreakRef,
  TeacherPortalDataBundle,
  TeacherPortalGyanEngagementRef,
  TeacherPortalMeetSession,
  TeacherPortalMockPaperRef,
  TeacherPortalMotivationLogItem,
  TeacherPortalProfileView,
  TeacherPortalReferStats,
  TeacherPortalSessionItem,
  TeacherPortalSessionWorkKind,
  TeacherPortalSummary,
  TeacherVerificationStatus,
  TeacherPortalWallItem,
} from "@/lib/teacherPortal/types";

type DbClient = SupabaseClient<Database>;

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

export const TEACHER_VERIFICATION_REQUIRED_ERROR =
  "Teacher verification approval is required before performing this action.";

type TeacherMutationGuardOptions = {
  skipVerificationCheck?: boolean;
};

async function assertTeacherApprovedForMutations(
  teacherId: string,
  db: DbClient,
  options?: TeacherMutationGuardOptions
): Promise<void> {
  if (options?.skipVerificationCheck) return;
  const trimmedTeacherId = teacherId.trim();
  if (!trimmedTeacherId) throw new Error("Teacher id is required.");
  const { data, error } = await (
    db as unknown as {
      from: (table: string) => {
        select: (columns: string) => {
          eq: (column: string, value: string) => {
            maybeSingle: () => Promise<{
              data: { verification_status?: TeacherVerificationStatus | null } | null;
              error: { message?: string } | null;
            }>;
          };
        };
      };
    }
  )
    .from("teacher_profile_details")
    .select("verification_status")
    .eq("teacher_id", trimmedTeacherId)
    .maybeSingle();
  if (error) throw ensureError(error);
  if ((data?.verification_status ?? "unverified") !== "approved") {
    throw new Error(TEACHER_VERIFICATION_REQUIRED_ERROR);
  }
}

function normalizeIndianPhone(raw: string | null | undefined): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  const core = digits.startsWith("91") && digits.length >= 12 ? digits.slice(2, 12) : digits.slice(0, 10);
  return core.length === 10 ? `+91 ${core}` : "";
}

function isValidIndianPhone(raw: string | null | undefined): boolean {
  return normalizeIndianPhone(raw).length > 0;
}

function hasValue(raw: string | null | undefined): boolean {
  return Boolean(raw && raw.trim());
}

function hasIdentityDocs(input: {
  aadhar_photo_url?: string | null;
  aadhar_share_link?: string | null;
  institute_certificate_photo_url?: string | null;
  institute_certificate_share_link?: string | null;
}): boolean {
  return (
    (hasValue(input.aadhar_photo_url) || hasValue(input.aadhar_share_link)) &&
    (hasValue(input.institute_certificate_photo_url) || hasValue(input.institute_certificate_share_link))
  );
}

const JOIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomJoinCode(): string {
  const c = globalThis.crypto;
  if (c?.getRandomValues) {
    const bytes = new Uint8Array(6);
    c.getRandomValues(bytes);
    let s = "";
    for (let i = 0; i < 6; i++) s += JOIN_CODE_ALPHABET[bytes[i]! % JOIN_CODE_ALPHABET.length];
    return s;
  }
  return Array.from(
    { length: 6 },
    () => JOIN_CODE_ALPHABET[Math.floor(Math.random() * JOIN_CODE_ALPHABET.length)]
  ).join("");
}

/** 6-char codes for student join; avoids collisions with a few retries. */
async function allocateUniqueJoinCode(db: DbClient = supabase): Promise<string> {
  for (let attempt = 0; attempt < 16; attempt++) {
    const code = randomJoinCode();
    const { data, error } = await db
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

function normalizeScheduleYmd(raw: string): string | null {
  const date = raw.trim();
  if (!date) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(date);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

function localDateFromYmdAndTime(ymd: string, timeStr: string): Date | null {
  const tm = timeStr.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!tm) return null;
  const hh = String(tm[1]).padStart(2, "0");
  const mm = tm[2];
  const d = new Date(`${ymd}T${hh}:${mm}:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

type SectionScheduleInferInput = {
  schedule_date: string | null;
  schedule_time: string | null;
  duration_minutes: unknown;
  repeat_days: unknown;
  schedule_end_date: string | null;
};

/** Next occurrence from stored section schedule when live_sessions rows are missing or stale. */
function inferNextOccurrenceFromSectionSchedule(
  s: SectionScheduleInferInput,
  nowMs: number
): { iso: string; durationMinutes: number } | null {
  const dateRaw = typeof s.schedule_date === "string" ? s.schedule_date.trim() : "";
  const timeRaw = typeof s.schedule_time === "string" ? s.schedule_time.trim() : "";
  if (!dateRaw || !timeRaw) return null;
  const anchorYmd = normalizeScheduleYmd(dateRaw);
  if (!anchorYmd) return null;
  const dur =
    typeof s.duration_minutes === "number" &&
    Number.isFinite(s.duration_minutes) &&
    s.duration_minutes > 0
      ? s.duration_minutes
      : 60;
  const repeat = Array.isArray(s.repeat_days)
    ? (s.repeat_days as unknown[]).map((x) => String(x).trim()).filter(Boolean)
    : [];
  const endYmdRaw =
    typeof s.schedule_end_date === "string" && s.schedule_end_date.trim()
      ? normalizeScheduleYmd(s.schedule_end_date.trim())
      : null;
  const endDayMs = endYmdRaw
    ? (() => {
        const endMidnight = localDateFromYmdAndTime(endYmdRaw, "23:59");
        return endMidnight ? endMidnight.getTime() : null;
      })()
    : null;

  if (!repeat.length) {
    const start = localDateFromYmdAndTime(anchorYmd, timeRaw);
    if (!start) return null;
    const endT = start.getTime() + dur * 60 * 1000;
    if (endT < nowMs) return null;
    if (endDayMs != null && start.getTime() > endDayMs) return null;
    return { iso: start.toISOString(), durationMinutes: dur };
  }

  const now = new Date(nowMs);
  const scanStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (let add = 0; add < 120; add++) {
    const cal = new Date(scanStart);
    cal.setDate(scanStart.getDate() + add);
    const label = cal.toLocaleDateString("en-US", { weekday: "short" });
    if (!repeat.includes(label)) continue;
    const ymd2 = `${cal.getFullYear()}-${String(cal.getMonth() + 1).padStart(2, "0")}-${String(cal.getDate()).padStart(2, "0")}`;
    const cand = localDateFromYmdAndTime(ymd2, timeRaw);
    if (!cand) continue;
    const ms = cand.getTime();
    if (ms < nowMs) continue;
    if (endDayMs != null && ms > endDayMs) continue;
    return { iso: cand.toISOString(), durationMinutes: dur };
  }
  return null;
}

type InferredCardSession = {
  iso: string;
  durationMinutes: number;
  sectionId: string;
  sectionName: string;
  meetLink: string | null;
};

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

export async function loadTeacherPortalBundle(
  userId: string,
  client?: DbClient
): Promise<TeacherPortalDataBundle> {
  const db = client ?? supabase;
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
    db
      .from("profiles")
      .select(
        "id, name, avatar_url, bio, subjects, exam_tags, teaching_levels, visibility, rdm, google_connected"
      )
      .eq("id", userId)
      .maybeSingle(),
    // Supabase generated TS types may not include newly added columns yet (e.g. allow_adhoc_trial).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- narrow escape hatch until types are regenerated
    (db as any)
      .from("classrooms")
      .select(
        "id, name, subject, section, description, intro_video_url, teacher_id, join_code, google_meet_link, google_recurring_event_id, allow_adhoc_trial"
      )
      .eq("teacher_id", userId)
      .order("created_at", { ascending: false }),
    db
      .from("classroom_members")
      .select("classroom_id, role")
      .in(
        "classroom_id",
        (await db.from("classrooms").select("id").eq("teacher_id", userId)).data?.map(
          (c) => c.id
        ) ?? [""]
      ),
    db
      .from("posts")
      .select(
        "id, classroom_id, section_id, type, created_at, title, description, due_date, content_json, teacher_id"
      )
      .eq("teacher_id", userId),
    db
      .from("live_sessions")
      .select(
        "id, classroom_id, section_id, title, scheduled_at, duration_minutes, meet_link, status, plan_json, pre_assignment_post_id, post_assignment_post_id"
      )
      .eq("teacher_id", userId)
      .order("scheduled_at", { ascending: true }),
    db
      .from("doubts")
      .select("id, title, body, subject, created_at, upvotes, user_id")
      .order("created_at", { ascending: false })
      .limit(30),
    db
      .from("doubt_answers")
      .select("id, doubt_id, body, user_id, upvotes, created_at")
      .order("created_at", { ascending: false }),
    db
      .from("accepted_answer_payouts")
      .select("rdm_paid, paid_at")
      .eq("user_id", userId)
      .gte("paid_at", startOfWeekIso()),
  ]);

  const profile = profileRes.data ?? {
    id: userId,
    name: "Teacher",
    avatar_url: null,
    bio: null,
    subjects: null,
    exam_tags: null,
    teaching_levels: null,
    visibility: "public",
    rdm: 0,
    google_connected: false,
  };

  type ClassroomRow = {
    id: string;
    name: string;
    subject: string | null;
    section: string | null;
    description: string | null;
    intro_video_url?: string | null;
    teacher_id: string;
    join_code: string;
    google_meet_link?: string | null;
    google_recurring_event_id?: string | null;
    allow_adhoc_trial?: boolean | null;
  };

  const classroomRowsRaw = (classroomsRes.data ?? []) as ClassroomRow[];
  const classrooms: ClassroomRow[] = [];
  for (const c of classroomRowsRaw) {
    if (c.join_code?.trim()) {
      classrooms.push(c);
      continue;
    }
    try {
      const join_code = await allocateUniqueJoinCode(db);
      const { error } = await db
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

  const [memberRowsBase, postRows, sessionRows, sectionRowsRes, askerProfilesRes] = await Promise.all([
    classroomIds.length
      ? db
          .from("classroom_members")
          .select("classroom_id, role, section_id")
          .in("classroom_id", classroomIds)
      : Promise.resolve({ data: [], error: null }),
    classroomIds.length
      ? db
          .from("posts")
          .select(
            "id, classroom_id, section_id, type, title, description, due_date, content_json, created_at, teacher_id"
          )
          .eq("teacher_id", userId)
          .in("classroom_id", classroomIds)
      : Promise.resolve({ data: [], error: null }),
    classroomIds.length
      ? db
          .from("live_sessions")
          .select(
            "id, classroom_id, section_id, title, scheduled_at, duration_minutes, meet_link, status, plan_json, pre_assignment_post_id, post_assignment_post_id"
          )
          .eq("teacher_id", userId)
          .in("classroom_id", classroomIds)
          .order("scheduled_at", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    classroomIds.length
      ? db
          .from("classroom_sections" as never)
          .select(
            "id, classroom_id, name, sort_order, schedule_date, schedule_time, duration_minutes, repeat_days, schedule_end_date, is_active, google_meet_link, google_recurring_event_id"
          )
          .in("classroom_id", classroomIds)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    db
      .from("profiles")
      .select("id, name, role")
      .in("id", [...new Set((doubtsRes.data ?? []).map((d) => d.user_id))]),
  ]);

  const members = memberRowsBase.data ?? membersRes.data ?? [];
  const posts = postRows.data ?? postsRes.data ?? [];
  const sessions = sessionRows.data ?? sessionsRes.data ?? [];
  const sectionRows = sectionRowsRes.data ?? [];
  const doubts = doubtsRes.data ?? [];
  const answers = answersRes.data ?? [];

  const sectionsByClassroom = new Map<
    string,
    Array<{
      id: string;
      classroom_id: string;
      name: string;
      sort_order: number;
      schedule_end_date?: string | null;
      is_active?: boolean | null;
      google_meet_link?: string | null;
      google_recurring_event_id?: string | null;
    }>
  >();
  for (const s of sectionRows as unknown as Array<{
    id: string;
    classroom_id: string;
    name: string;
    sort_order: number;
    schedule_end_date?: string | null;
    is_active?: boolean | null;
    google_meet_link: string | null;
    google_recurring_event_id: string | null;
  }>) {
    const list = sectionsByClassroom.get(s.classroom_id) ?? [];
    list.push(s);
    sectionsByClassroom.set(s.classroom_id, list);
  }

  const memberCountMap = new Map<string, number>();
  members.forEach((m) => {
    const role = (m as { role?: string }).role;
    if (role === "teacher") return;
    memberCountMap.set(m.classroom_id, (memberCountMap.get(m.classroom_id) ?? 0) + 1);
  });

  const memberCountBySectionId = new Map<string, number>();
  members.forEach((m) => {
    const role = (m as { role?: string }).role;
    if (role === "teacher") return;
    const sid = (m as { section_id?: string | null }).section_id ?? null;
    if (!sid) return;
    memberCountBySectionId.set(sid, (memberCountBySectionId.get(sid) ?? 0) + 1);
  });

  // Classroom card assignment count should match "Assignments" tab (not all posts like motivation/session plans).
  const assignmentTypes = new Set(["assignment", "quiz", "mock", "Concept Focus"]);
  const assignmentCountMap = new Map<string, number>();
  posts.forEach((p) => {
    if (!assignmentTypes.has(String((p as { type?: unknown }).type ?? ""))) return;
    assignmentCountMap.set(p.classroom_id, (assignmentCountMap.get(p.classroom_id) ?? 0) + 1);
  });

  const sectionNameById = new Map<string, string>();
  const sectionMeetById = new Map<string, string | null>();
  for (const list of sectionsByClassroom.values()) {
    for (const s of list) {
      sectionNameById.set(s.id, s.name);
      sectionMeetById.set(s.id, s.google_meet_link ?? null);
    }
  }

  const classroomMeetById = new Map<string, string | null>(
    classrooms.map((c) => [
      c.id,
      ((c as { google_meet_link?: string | null }).google_meet_link ?? null) as string | null,
    ])
  );

  const nowMs = Date.now();
  const inferredCardSessionByClassroom = new Map<string, InferredCardSession>();
  for (const c of classrooms) {
    const secs = sectionsByClassroom.get(c.id) ?? [];
    let best: InferredCardSession | null = null;
    for (const sec of secs) {
      const hit = inferNextOccurrenceFromSectionSchedule(
        sec as unknown as SectionScheduleInferInput,
        nowMs
      );
      if (!hit) continue;
      const t = Date.parse(hit.iso);
      if (!Number.isFinite(t)) continue;
      if (!best || t < Date.parse(best.iso)) {
        best = {
          iso: hit.iso,
          durationMinutes: hit.durationMinutes,
          sectionId: sec.id,
          sectionName: sec.name,
          meetLink: (sec as { google_meet_link?: string | null }).google_meet_link ?? null,
        };
      }
    }
    if (best) inferredCardSessionByClassroom.set(c.id, best);
  }

  const nextSessionMap = new Map<string, string>();
  const meetSessionsByClassroom = new Map<string, TeacherPortalMeetSession[]>();
  const isCancelled = (status: unknown) => {
    const st = typeof status === "string" ? status.trim().toLowerCase() : "";
    return st === "cancelled" || st === "canceled";
  };
  const safeDurationMinutes = (dur: unknown) => {
    const n = Number(dur);
    return Number.isFinite(n) && n > 0 ? n : 60;
  };
  sessions.forEach((s) => {
    if (isCancelled((s as { status?: unknown }).status)) return;
    const start = Date.parse(String((s as { scheduled_at?: unknown }).scheduled_at ?? ""));
    if (!Number.isFinite(start)) return;
    const durMin = safeDurationMinutes((s as { duration_minutes?: unknown }).duration_minutes);
    const end = start + durMin * 60 * 1000;
    // nearest upcoming/live only
    if (end < nowMs) return;

    if (!nextSessionMap.has(s.classroom_id)) nextSessionMap.set(s.classroom_id, String(s.scheduled_at));
    const sid =
      typeof (s as { section_id?: unknown }).section_id === "string"
        ? String((s as { section_id: string }).section_id)
        : null;
    let meetLink =
      typeof (s as { meet_link?: unknown }).meet_link === "string"
        ? String((s as { meet_link: string }).meet_link)
        : null;
    if (!meetLink && sid) meetLink = sectionMeetById.get(sid) ?? null;
    if (!meetLink) meetLink = classroomMeetById.get(s.classroom_id) ?? null;
    if (!meetLink) {
      const list = sectionsByClassroom.get(s.classroom_id) ?? [];
      for (const sec of list) {
        const m = (sec as { google_meet_link?: string | null }).google_meet_link ?? null;
        if (m) {
          meetLink = m;
          break;
        }
      }
    }
    const sectionName = sid ? (sectionNameById.get(sid) ?? null) : null;
    const scopeLabel = sid ? `Only ${sectionName ?? "section"}` : "Whole class";
    const existing = meetSessionsByClassroom.get(s.classroom_id) ?? [];
    existing.push({
      id: String((s as { id?: unknown }).id ?? `${s.classroom_id}:${String(s.scheduled_at)}`),
      scheduledAt: String(s.scheduled_at),
      durationMinutes: durMin,
      meetLink,
      sectionId: sid,
      sectionName,
      scopeLabel,
    });
    meetSessionsByClassroom.set(s.classroom_id, existing);
  });
  for (const [cid, list] of meetSessionsByClassroom.entries()) {
    list.sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt));
    meetSessionsByClassroom.set(cid, list.slice(0, 8));
  }

  const classroomCards: TeacherPortalClassroomCard[] = classrooms.map((c) => {
    const studentCount = memberCountMap.get(c.id) ?? 0;
    const assignmentCount = assignmentCountMap.get(c.id) ?? 0;
    const avgScorePercent: number | null = null;
    const isDemoShowcase = isTeacherPortalDemoShowcaseClassroom(c.id, c.name);
    const nextSessionIso = nextSessionMap.get(c.id) ?? null;
    const secs = sectionsByClassroom.get(c.id) ?? [];
    const sectionSeriesLinked = secs.some((sec) =>
      Boolean((sec as { google_recurring_event_id?: string | null }).google_recurring_event_id)
    );
    const googleSeriesLinked =
      Boolean((c as { google_recurring_event_id?: string | null }).google_recurring_event_id) ||
      sectionSeriesLinked;
    const meetSessions = meetSessionsByClassroom.get(c.id) ?? [];
    const nextMeet = meetSessions[0] ?? null;
    const inferred = inferredCardSessionByClassroom.get(c.id) ?? null;
    const classMeet = (c as { google_meet_link?: string | null }).google_meet_link ?? null;

    let nextSessionAt: string | null = nextMeet?.scheduledAt ?? nextSessionIso ?? null;
    let nextSessionDurationMinutes: number | null = nextMeet?.durationMinutes ?? null;
    let nextMeetScopeLabel: string | null = nextMeet?.scopeLabel ?? null;
    let nextSessionSectionId: string | null = nextMeet?.sectionId ?? null;

    if (!nextSessionAt && inferred) {
      nextSessionAt = inferred.iso;
      if (nextSessionDurationMinutes == null) nextSessionDurationMinutes = inferred.durationMinutes;
      if (!nextMeetScopeLabel) nextMeetScopeLabel = `Only ${inferred.sectionName}`;
      if (!nextSessionSectionId) nextSessionSectionId = inferred.sectionId;
    }

    let nextMeetLink: string | null = nextMeet?.meetLink ?? null;
    if (!nextMeetLink && inferred?.meetLink) nextMeetLink = inferred.meetLink;
    if (!nextMeetLink) nextMeetLink = classMeet;
    if (!nextMeetLink) {
      for (const sec of secs) {
        const m = (sec as { google_meet_link?: string | null }).google_meet_link ?? null;
        if (m) {
          nextMeetLink = m;
          break;
        }
      }
    }

    if (nextMeetLink && !nextMeetScopeLabel) {
      if (classMeet && nextMeetLink === classMeet) nextMeetScopeLabel = "Whole class";
      else {
        const secHit = secs.find(
          (sec) => ((sec as { google_meet_link?: string | null }).google_meet_link ?? null) === nextMeetLink
        );
        if (secHit) nextMeetScopeLabel = `Only ${secHit.name}`;
      }
    }

    const effectiveNextIso = nextSessionAt;
    const nextSessionLabel = effectiveNextIso
      ? formatSessionLabel(effectiveNextIso)
      : googleSeriesLinked
        ? "Google Calendar series active"
        : "No session scheduled";

    return {
      id: c.id,
      name: c.name,
      subject: c.subject,
      section: c.section,
      description: c.description,
      allowAdhocTrial: (c as { allow_adhoc_trial?: boolean | null }).allow_adhoc_trial ?? true,
      introVideoUrl: (c as { intro_video_url?: string | null }).intro_video_url ?? null,
      googleMeetLink: classMeet,
      nextMeetLink,
      nextMeetScopeLabel,
      nextSessionAt,
      nextSessionSectionId,
      nextSessionDurationMinutes,
      meetSessions,
      googleSeriesLinked,
      joinCode: c.join_code,
      isDemoShowcase,
      studentCount,
      assignmentCount,
      avgScorePercent,
      nextSessionLabel,
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
    const planJsonRaw = (s as Record<string, unknown>).plan_json;
    const rowPlan =
      planJsonRaw != null && typeof planJsonRaw === "object" && !Array.isArray(planJsonRaw)
        ? asObject(planJsonRaw as Json)
        : {};
    const hasRowPlan = Object.keys(rowPlan).length > 0;
    const plansForRoom = sessionPlanPosts
      .filter((p) => p.classroom_id === s.classroom_id)
      .sort((a, b) => {
        const at = a.created_at ? Date.parse(a.created_at) : 0;
        const bt = b.created_at ? Date.parse(b.created_at) : 0;
        return (Number.isFinite(bt) ? bt : 0) - (Number.isFinite(at) ? at : 0);
      });
    /** Prefer exact `scheduledAt` match so repeated titles (e.g. "Linear") don't pick the wrong plan. */
    const matchedPlan =
      plansForRoom.find((p) => {
        const payload = asObject(p.content_json);
        const planScheduledAt =
          typeof payload.scheduledAt === "string" ? payload.scheduledAt.trim() : "";
        return planScheduledAt && planScheduledAt === s.scheduled_at;
      }) ??
      plansForRoom.find((p) => p.title?.trim() === `${s.title} plan`);

    const sessionPlanPayload = hasRowPlan
      ? rowPlan
      : matchedPlan
        ? asObject(matchedPlan.content_json)
        : {};
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

    const readJsonObject = (camel: string, snake: string): unknown => {
      const a = sessionPlanPayload[camel];
      if (a && typeof a === "object" && !Array.isArray(a)) return a;
      const b = sessionPlanPayload[snake];
      if (b && typeof b === "object" && !Array.isArray(b)) return b;
      return null;
    };
    const readModeStr = (camel: string, snake: string): string => {
      const a = sessionPlanPayload[camel];
      if (typeof a === "string") return a;
      const b = sessionPlanPayload[snake];
      if (typeof b === "string") return b;
      return "";
    };

    const preConceptRef = readJsonObject("preWorkConceptRef", "pre_work_concept_ref");
    const postConceptRef = readJsonObject("postWorkConceptRef", "post_work_concept_ref");
    const preWorkModeStr = readModeStr("preWorkMode", "pre_work_mode");
    const postWorkModeStr = readModeStr("postWorkMode", "post_work_mode");

    const preWorkFromField = normalizePreviewList(sessionPlanPayload.preWork);
    const postWorkFromField = normalizePreviewList(sessionPlanPayload.postWork);

    const sessionPlanAttached = hasRowPlan || Boolean(matchedPlan);
    const preKind: TeacherPortalSessionWorkKind = sessionPlanAttached
      ? inferSessionWorkKind(preWorkModeStr, preConceptRef, preWorkFromField)
      : "custom";
    const postKind: TeacherPortalSessionWorkKind = sessionPlanAttached
      ? inferSessionWorkKind(postWorkModeStr, postConceptRef, postWorkFromField)
      : "custom";

    let preWork = preWorkFromField;
    let postWork = postWorkFromField;
    if (preWork.length === 0 && preKind === "concept_focus") {
      preWork = normalizePreviewList(preConceptRef);
    }
    if (postWork.length === 0 && postKind === "concept_focus") {
      postWork = normalizePreviewList(postConceptRef);
    }

    let preWorkDisplay = "";
    if (sessionPlanAttached) {
      if (preKind === "concept_focus") {
        preWorkDisplay =
          formatConceptFocusRefForDisplay(preConceptRef).trim() ||
          normalizePreviewList(preConceptRef).join(" · ");
        if (!preWorkDisplay) {
          preWorkDisplay = "Concept focus — choose chapter, topic, and subtopic in the session plan.";
        }
      } else {
        preWorkDisplay = preWorkFromField.join("\n\n").trim();
      }
    }
    if (!preWorkDisplay.trim()) {
      preWorkDisplay = sessionPlanAttached
        ? "No pre-work instructions saved in the session plan."
        : "No session plan linked yet — add one when scheduling so students see the correct tasks.";
    }

    let postWorkDisplay = "";
    if (sessionPlanAttached) {
      if (postKind === "concept_focus") {
        postWorkDisplay =
          formatConceptFocusRefForDisplay(postConceptRef).trim() ||
          normalizePreviewList(postConceptRef).join(" · ");
        if (!postWorkDisplay) {
          postWorkDisplay =
            "Concept focus — choose chapter, topic, and subtopic for post-work in the session plan.";
        }
      } else {
        postWorkDisplay = postWorkFromField.join("\n\n").trim();
      }
    }
    if (!postWorkDisplay.trim()) {
      postWorkDisplay = sessionPlanAttached
        ? "No post-work instructions saved in the session plan."
        : "No session plan linked yet — add one when scheduling so students see the correct tasks.";
    }

    const delayRaw =
      sessionPlanPayload.postWorkDelayDays ?? sessionPlanPayload.post_work_delay_days;
    const delayDays =
      Number.isFinite(Number(delayRaw)) && Number(delayRaw) >= 0 ? Math.floor(Number(delayRaw)) : 0;
    const postWorkReleaseLabel = sessionPlanAttached ? postWorkDelayLabel(delayDays) : null;

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
      sectionId: (s as { section_id?: string | null }).section_id ?? null,
      sectionName: (() => {
        const sid = (s as { section_id?: string | null }).section_id ?? null;
        if (!sid) return null;
        for (const list of sectionsByClassroom.values()) {
          const hit = list.find((sec) => sec.id === sid);
          if (hit) return hit.name;
        }
        return null;
      })(),
      classroomName: classroomNameMap.get(s.classroom_id) ?? "Classroom",
      title: s.title,
      scheduledAt: s.scheduled_at,
      durationMinutes: s.duration_minutes,
      meetLink: s.meet_link,
      studentCount:
        (s as { section_id?: string | null }).section_id != null
          ? memberCountBySectionId.get((s as { section_id?: string | null }).section_id ?? "") ?? 0
          : memberCountMap.get(s.classroom_id) ?? 0,
      status: s.status,
      isTrial: classroom?.description?.toLowerCase().includes("ad-hoc trial: enabled") ?? false,
      rewardRdm: typeof assignmentPayload.rewardRdm === "number" ? assignmentPayload.rewardRdm : 20,
      preWork: preWork.length ? preWork : ["Warm-up worksheet", "Revise previous class notes"],
      postWork: postWork.length
        ? postWork
        : ["DailyDose practice set", "Post class reflection in Gyan++"],
      sessionPlanAttached,
      preWorkKind: preKind,
      postWorkKind: postKind,
      preWorkDisplay,
      postWorkDisplay,
      postWorkReleaseLabel,
      resources: resources.length
        ? resources
        : [
            { label: "Class Notes PDF", href: null },
            { label: "Practice Worksheet", href: null },
          ],
    };
  });

  const memberProfilesRes = classroomIds.length
    ? await db
        .from("classroom_members")
        .select("classroom_id, user_id, role, joined_at, section_id, profiles(name, avatar_url, rdm)")
        .in("classroom_id", classroomIds)
    : { data: [], error: null };
  const anyDemoShowcaseClassroom = classrooms.some((c) =>
    isTeacherPortalDemoShowcaseClassroom(c.id, c.name)
  );
  const demoStudentsRes = anyDemoShowcaseClassroom
    ? await db
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
      section_id: string | null;
      profiles: { name: string; avatar_url: string | null; rdm: number | null } | null;
    }>) ?? [];

  const detailMap: Record<string, TeacherPortalClassroomDetail> = {};
  classroomIds.forEach((id) => {
    detailMap[id] = {
      classroomId: id,
      sections: (sectionsByClassroom.get(id) ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        sortOrder: Number(s.sort_order ?? 0),
        scheduleEndDate:
          typeof (s as { schedule_end_date?: unknown }).schedule_end_date === "string"
            ? String((s as { schedule_end_date: string }).schedule_end_date)
            : null,
        isActive: (() => {
          // Prefer DB flag (when available), else compute from schedule_end_date.
          const flag = (s as { is_active?: unknown }).is_active;
          if (typeof flag === "boolean") return flag;
          const end = (s as { schedule_end_date?: unknown }).schedule_end_date;
          if (typeof end !== "string" || !end.trim()) return true;
          if (!/^\d{4}-\d{2}-\d{2}$/.test(end.trim())) return true;
          const today = new Date();
          const todayIso = new Date(
            Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
          )
            .toISOString()
            .slice(0, 10);
          // Expire after end date passes (end < today).
          return end.trim() >= todayIso;
        })(),
        scheduleLabel: (() => {
          const repeat = Array.isArray((s as { repeat_days?: unknown }).repeat_days)
            ? (((s as unknown as { repeat_days: string[] }).repeat_days ?? []) as string[]).filter(Boolean)
            : [];
          const date = typeof (s as { schedule_date?: unknown }).schedule_date === "string"
            ? String((s as unknown as { schedule_date: string }).schedule_date)
            : "";
          const time = typeof (s as { schedule_time?: unknown }).schedule_time === "string"
            ? String((s as unknown as { schedule_time: string }).schedule_time)
            : "";
          const dur =
            typeof (s as { duration_minutes?: unknown }).duration_minutes === "number"
              ? Number((s as unknown as { duration_minutes: number }).duration_minutes)
              : null;
          if (!date || !time || !dur) return null;
          const normalizedDate = (() => {
            if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
            const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(date);
            if (m) return `${m[3]}-${m[2]}-${m[1]}`;
            return date;
          })();
          const start = new Date(`${normalizedDate}T${time}:00`);
          if (Number.isNaN(start.getTime())) return null;
          const end = new Date(start.getTime() + dur * 60 * 1000);
          const startLabel = start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
          const endLabel = end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
          const repeatLabel = repeat.length ? repeat.join(" / ") : "One-time";
          return `${repeatLabel} · ${startLabel}–${endLabel}`;
        })(),
        googleMeetLink: (s as { google_meet_link?: string | null }).google_meet_link ?? null,
        googleSeriesLinked: Boolean(
          (s as { google_recurring_event_id?: string | null }).google_recurring_event_id
        ),
      })),
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
      sectionId: row.section_id ?? null,
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
          sectionId: null,
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
    const { data: prog, error: progErr } = await db
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
    const { data: profileRows, error: profileErr } = await db
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
    const genericSupabase = db as unknown as {
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
      sectionId:
        typeof (post as unknown as { section_id?: unknown }).section_id === "string"
          ? String((post as unknown as { section_id: string }).section_id)
          : null,
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
      sectionId:
        typeof (post as unknown as { section_id?: unknown }).section_id === "string"
          ? String((post as unknown as { section_id: string }).section_id)
          : null,
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

  const profileRowsRes = await db
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
    googleCalendarConnected: Boolean(
      (profile as { google_connected?: boolean | null }).google_connected
    ),
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
    contact_email_verified_at: string | null;
    verified_contact_email: string | null;
    verification_status: TeacherVerificationStatus | null;
    admin_notes: string | null;
    submitted_at: string | null;
    reviewed_at: string | null;
    approved_at: string | null;
    rejected_at: string | null;
  };

  const { data: teacherDetailsRowRaw } = await (
    db as unknown as {
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
      "teacher_id, location, qualification, experience, email, phone, youtube_or_social, aadhar_photo_url, aadhar_share_link, institute_certificate_photo_url, institute_certificate_share_link, contact_email_verified_at, verified_contact_email, verification_status, admin_notes, submitted_at, reviewed_at, approved_at, rejected_at"
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
    visibility: profile.visibility ?? "public",
    rdm: profile.rdm ?? 0,
    studentsHelped: summary.totalStudents,
    expertAnswers: summary.teacherSectionsWritten,
    avgUpvotes: summary.avgTeacherUpvotes,
    details: {
      location: details.location ?? null,
      qualification: details.qualification ?? null,
      experience: details.experience ?? null,
      email: details.email ?? null,
      verifiedContactEmail: teacherDetailsRowRaw?.verified_contact_email ?? null,
      contactEmailVerifiedAt: teacherDetailsRowRaw?.contact_email_verified_at ?? null,
      verificationStatus: teacherDetailsRowRaw?.verification_status ?? "unverified",
      adminNotes: teacherDetailsRowRaw?.admin_notes ?? null,
      submittedAt: teacherDetailsRowRaw?.submitted_at ?? null,
      reviewedAt: teacherDetailsRowRaw?.reviewed_at ?? null,
      approvedAt: teacherDetailsRowRaw?.approved_at ?? null,
      rejectedAt: teacherDetailsRowRaw?.rejected_at ?? null,
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

export async function postTeacherSection(
  input: {
  doubtId: string;
  teacherId: string;
  body: string;
},
  client?: DbClient,
  options?: TeacherMutationGuardOptions
): Promise<void> {
  const db = client ?? supabase;
  await assertTeacherApprovedForMutations(input.teacherId, db, options);
  const trimmed = input.body.trim();
  if (!trimmed) throw new Error("Teacher section cannot be empty.");
  const { error } = await db.from("doubt_answers").insert({
    doubt_id: input.doubtId,
    user_id: input.teacherId,
    body: trimmed,
  });
  if (error) throw error;
}

export async function updateTeacherProfile(
  input: {
  userId: string;
  name: string;
  bio: string;
  visibility: string;
  subjects: string[];
  examTags: string[];
  teachingLevels: number[];
  /** Full public URL (e.g. Supabase Storage public URL or OAuth picture URL). */
  avatarUrl?: string | null;
  details?: TeacherProfileDetails;
  bypassVerificationLock?: boolean;
},
  client?: DbClient
): Promise<void> {
  const db = client ?? supabase;
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

  const profilePatch: Record<string, unknown> = {
    name: input.name.trim(),
    bio: encodedBio.trim() || null,
    visibility: input.visibility,
    subjects: cleanSubjects,
    exam_tags: cleanExamTags,
    teaching_levels: cleanLevels,
  };
  if (input.avatarUrl !== undefined) {
    profilePatch.avatar_url = input.avatarUrl;
  }

  const d = input.details ?? {};
  const docs = d.docs ?? {};

  const dbAny = db as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (c: string, v: string) => {
          maybeSingle: () => Promise<{
            data: {
              verified_contact_email?: string | null;
              verification_status?: TeacherVerificationStatus | null;
              name?: string | null;
              subjects?: string[] | null;
              exam_tags?: string[] | null;
              location?: string | null;
              qualification?: string | null;
              experience?: string | null;
              phone?: string | null;
              aadhar_photo_url?: string | null;
              aadhar_share_link?: string | null;
              institute_certificate_photo_url?: string | null;
              institute_certificate_share_link?: string | null;
            } | null;
          }>;
        };
      };
    };
  };
  const { data: prevTeacherDetails } = await dbAny
    .from("teacher_profile_details")
    .select(
      "verified_contact_email, verification_status, location, qualification, experience, phone, aadhar_photo_url, aadhar_share_link, institute_certificate_photo_url, institute_certificate_share_link"
    )
    .eq("teacher_id", input.userId)
    .maybeSingle();
  const { data: prevProfileCore } = await dbAny
    .from("profiles")
    .select("name, subjects, exam_tags")
    .eq("id", input.userId)
    .maybeSingle();

  const nextEmailNorm = (d.email ?? "").trim().toLowerCase();
  const prevVerifiedNorm = (
    (prevTeacherDetails as { verified_contact_email?: string | null } | null)?.verified_contact_email ?? ""
  )
    .trim()
    .toLowerCase();

  const verificationPatch: Record<string, unknown> = {};
  if (!nextEmailNorm) {
    verificationPatch.contact_email_verified_at = null;
    verificationPatch.verified_contact_email = null;
  } else if (prevVerifiedNorm && prevVerifiedNorm !== nextEmailNorm) {
    verificationPatch.contact_email_verified_at = null;
    verificationPatch.verified_contact_email = null;
  }

  const nextProfileName = input.name.trim();
  const nextSubjects = cleanSubjects;
  const nextExamTags = cleanExamTags;
  const nextLocation = d.location?.trim() || "";
  const nextQualification = d.qualification?.trim() || "";
  const nextExperience = d.experience?.trim() || "";
  const nextPhone = normalizeIndianPhone(d.phone ?? "");
  const detailsPayload = {
    teacher_id: input.userId,
    location: nextLocation || null,
    qualification: nextQualification || null,
    experience: nextExperience || null,
    email: d.email?.trim() || null,
    phone: nextPhone || null,
    youtube_or_social: d.youtubeOrSocial?.trim() || null,
    aadhar_photo_url: docs.aadharPhotoUrl?.trim() || null,
    aadhar_share_link: docs.aadharShareLink?.trim() || null,
    institute_certificate_photo_url: docs.instituteCertificatePhotoUrl?.trim() || null,
    institute_certificate_share_link: docs.instituteCertificateShareLink?.trim() || null,
    ...verificationPatch,
  };

  const verificationStatus = prevTeacherDetails?.verification_status ?? "unverified";
  const approvedLocked = verificationStatus === "approved" && !input.bypassVerificationLock;

  if (approvedLocked) {
    const prevName = (prevProfileCore?.name ?? "").trim();
    const prevSubjects = (prevProfileCore?.subjects ?? []).map((s) => s.trim());
    const prevExamTags = (prevProfileCore?.exam_tags ?? []).map((s) => s.trim());
    const prevLocation = (prevTeacherDetails?.location ?? "").trim();
    const prevQualification = (prevTeacherDetails?.qualification ?? "").trim();
    const prevExperience = (prevTeacherDetails?.experience ?? "").trim();
    const prevPhone = normalizeIndianPhone(prevTeacherDetails?.phone ?? "");
    const prevAadharPhoto = (prevTeacherDetails?.aadhar_photo_url ?? "").trim();
    const prevAadharShare = (prevTeacherDetails?.aadhar_share_link ?? "").trim();
    const prevCertPhoto = (prevTeacherDetails?.institute_certificate_photo_url ?? "").trim();
    const prevCertShare = (prevTeacherDetails?.institute_certificate_share_link ?? "").trim();
    const changedCoreIdentity =
      prevName !== nextProfileName ||
      prevSubjects.join("|") !== nextSubjects.join("|") ||
      prevExamTags.join("|") !== nextExamTags.join("|") ||
      prevLocation !== nextLocation ||
      prevQualification !== nextQualification ||
      prevExperience !== nextExperience ||
      prevPhone !== nextPhone ||
      prevAadharPhoto !== (detailsPayload.aadhar_photo_url ?? "") ||
      prevAadharShare !== (detailsPayload.aadhar_share_link ?? "") ||
      prevCertPhoto !== (detailsPayload.institute_certificate_photo_url ?? "") ||
      prevCertShare !== (detailsPayload.institute_certificate_share_link ?? "");
    if (changedCoreIdentity) {
      throw new Error(
        "Your profile is verified. Core identity fields are locked; contact admin for corrections."
      );
    }
  }

  const hasMandatoryFields =
    hasValue(nextProfileName) &&
    nextSubjects.length > 0 &&
    nextExamTags.length > 0 &&
    hasValue(nextLocation) &&
    hasValue(nextQualification) &&
    hasValue(nextExperience) &&
    isValidIndianPhone(nextPhone) &&
    hasIdentityDocs(detailsPayload);

  if (!input.bypassVerificationLock && !hasMandatoryFields) {
    throw new Error(
      "Complete full name, phone (+91 10 digits), subjects, specialisation, location, qualification, experience, and both identity documents."
    );
  }

  if (verificationStatus !== "approved" && hasMandatoryFields) {
    (detailsPayload as Record<string, unknown>).verification_status = "pending";
    (detailsPayload as Record<string, unknown>).submitted_at = new Date().toISOString();
    if (verificationStatus === "rejected") {
      (detailsPayload as Record<string, unknown>).admin_notes = null;
      (detailsPayload as Record<string, unknown>).rejected_at = null;
      (detailsPayload as Record<string, unknown>).reviewed_at = null;
    }
  } else if (!approvedLocked && verificationStatus === "unverified") {
    (detailsPayload as Record<string, unknown>).verification_status = "unverified";
  }

  const { error } = await db.from("profiles").update(profilePatch).eq("id", input.userId);
  if (error) throw error;

  const { error: detailsErr } = await (
    db as unknown as {
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

export async function createTeacherClassroom(
  input: {
  userId: string;
  name: string;
  subject: string;
  pucLevel: "PUC 1" | "PUC 2" | "Both";
  examTarget: string;
  scheduleDate: string | null;
  scheduleTime: string | null;
  durationMinutes: number;
  repeatDays: string[];
  /** Optional last day for recurrence (YYYY-MM-DD); also sent to Google as RRULE UNTIL when set. */
  scheduleEndDate?: string | null;
  allowAdhocTrial: boolean;
},
  client?: DbClient,
  options?: TeacherMutationGuardOptions
): Promise<{ classroomId: string }> {
  const db = client ?? supabase;
  await assertTeacherApprovedForMutations(input.userId, db, options);
  const className = input.name.trim();
  if (!className) throw new Error("Classroom name is required.");

  const repeatText = input.repeatDays.length ? input.repeatDays.join(", ") : "No repeat selected";
  const scheduleText =
    input.scheduleDate && input.scheduleTime
      ? `${input.scheduleDate} ${input.scheduleTime} · ${input.durationMinutes} mins`
      : "Schedule not set";
  const endNote =
    input.scheduleEndDate?.trim() ? `End date: ${input.scheduleEndDate.trim()}` : "End date: open-ended";
  const notes = [
    `Exam target: ${input.examTarget}`,
    `Ad-hoc trial: ${input.allowAdhocTrial ? "Enabled" : "Disabled"}`,
    `Repeat: ${repeatText}`,
    `Schedule: ${scheduleText}`,
    endNote,
  ].join(" | ");

  const join_code = await allocateUniqueJoinCode(db);
  const { data: insertedClassroom, error: classErr } = await db
    .from("classrooms")
    .insert({
      teacher_id: input.userId,
      name: className,
      subject: input.subject,
      section: input.pucLevel,
      description: notes,
      type: "standard",
      join_code,
      allow_adhoc_trial: input.allowAdhocTrial,
    })
    .select("id")
    .single();
  if (classErr) throw ensureError(classErr);

  const classroomId = insertedClassroom.id;
  const { error: membershipErr } = await db.from("classroom_members").insert({
    classroom_id: classroomId,
    user_id: input.userId,
    role: "teacher",
  });
  if (membershipErr && membershipErr.code !== "23505") throw ensureError(membershipErr);

  if (input.scheduleDate && input.scheduleTime) {
    const scheduledAt = new Date(`${input.scheduleDate}T${input.scheduleTime}:00`);
    if (!Number.isNaN(scheduledAt.getTime())) {
      const { error: sessionErr } = await db.from("live_sessions").insert({
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

  return { classroomId };
}

export async function updateTeacherClassroom(
  input: {
  teacherId: string;
  classroomId: string;
  name: string;
  subject: string | null;
  section: string | null;
  introVideoUrl?: string | null;
},
  client?: DbClient,
  options?: TeacherMutationGuardOptions
): Promise<void> {
  const db = client ?? supabase;
  await assertTeacherApprovedForMutations(input.teacherId, db, options);
  const name = input.name.trim();
  if (!name) throw new Error("Classroom name is required.");
  const { error } = await db
    .from("classrooms")
    .update({
      name,
      subject: input.subject?.trim() || null,
      section: input.section?.trim() || null,
      intro_video_url: input.introVideoUrl?.trim() || null,
    })
    .eq("id", input.classroomId)
    .eq("teacher_id", input.teacherId);
  if (error) throw ensureError(error);
}

export async function deleteTeacherClassroom(
  input: {
  teacherId: string;
  classroomId: string;
},
  client?: DbClient,
  options?: TeacherMutationGuardOptions
): Promise<void> {
  const db = client ?? supabase;
  await assertTeacherApprovedForMutations(input.teacherId, db, options);
  const { error } = await db
    .from("classrooms")
    .delete()
    .eq("id", input.classroomId)
    .eq("teacher_id", input.teacherId);
  if (error) throw ensureError(error);
}

export async function createClassroomAssignment(
  input: {
  teacherId: string;
  classroomId: string;
  sectionId?: string | null;
  assignmentType: string;
  title: string;
  dueDate: string | null;
  /** Optional exact due datetime (ISO) for timed publishing flows. */
  dueDateIso?: string | null;
  assignToLabel: string;
  /** When provided, the assignment is visible only to these students (within the selected scope). */
  targetStudentIds?: string[] | null;
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
},
  client?: DbClient,
  options?: TeacherMutationGuardOptions
): Promise<{ id: string }> {
  const db = client ?? supabase;
  await assertTeacherApprovedForMutations(input.teacherId, db, options);
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
          href: appendQueryParams(path, { ...extra, panel: "concepts" }),
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
    ...(Array.isArray(input.targetStudentIds) && input.targetStudentIds.length
      ? {
          assignToKind: "custom",
          targetStudentIds: input.targetStudentIds.filter(
            (id): id is string => typeof id === "string" && id.trim().length > 0
          ),
        }
      : {}),
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

  const { data: insertedPost, error } = await db
    .from("posts")
    .insert({
      classroom_id: input.classroomId,
      section_id: input.sectionId ?? null,
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
    const { error: updateErr } = await db
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

export async function createMotivationAction(
  input: {
  teacherId: string;
  classroomId: string;
  sectionId?: string | null;
  actionKind: "boost" | "nudge" | "urgent_nudge";
  targetStudentIds: string[];
  message: string;
  rdmDelta: number;
  /** Optional deep-link target (e.g. assignment post id). */
  relatedPostId?: string;
  relatedPostTitle?: string;
  /** Optional recommended action to show as link in notifications. */
  recommendActionId?: "attempt_targeted_mock" | "post_doubt" | "watch_recorded" | "none";
  recommendActionLabel?: string;
  recommendActionUrl?: string;
},
  client?: DbClient,
  options?: TeacherMutationGuardOptions
): Promise<void> {
  const db = client ?? supabase;
  await assertTeacherApprovedForMutations(input.teacherId, db, options);
  const { error } = await db.from("posts").insert({
    classroom_id: input.classroomId,
    section_id: input.sectionId ?? null,
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
      ...(input.relatedPostId ? { relatedPostId: input.relatedPostId } : {}),
      ...(input.relatedPostTitle ? { relatedPostTitle: input.relatedPostTitle } : {}),
      ...(input.recommendActionId ? { recommendActionId: input.recommendActionId } : {}),
      ...(input.recommendActionLabel ? { recommendActionLabel: input.recommendActionLabel } : {}),
      ...(input.recommendActionUrl ? { recommendActionUrl: input.recommendActionUrl } : {}),
    },
  });
  if (error) throw error;
}

export async function createRewardTopStudentsAction(
  input: {
  teacherId: string;
  classroomId: string;
  sectionId?: string | null;
  targetStudentIds: string[];
  message: string;
  rdmDelta: number;
},
  client?: DbClient,
  options?: TeacherMutationGuardOptions
): Promise<void> {
  const db = client ?? supabase;
  await assertTeacherApprovedForMutations(input.teacherId, db, options);
  const { error } = await db.from("posts").insert({
    classroom_id: input.classroomId,
    section_id: input.sectionId ?? null,
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
  classroomId: string,
  client?: DbClient
): Promise<TeacherPortalMotivationLogItem[]> {
  const db = client ?? supabase;
  const { data, error } = await db
    .from("posts")
    .select("id, classroom_id, section_id, teacher_id, type, title, created_at, content_json")
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
      sectionId: row.section_id ?? null,
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

export async function createTeacherLiveSession(
  input: {
  teacherId: string;
  classroomId: string;
  sectionId?: string | null;
  title: string;
  date: string;
  startTime: string;
  durationMinutes: number;
  meetLink: string;
  allowAdhocTrial: boolean;
  preWork: string;
  postWork: string;
  preWorkMode?: "none" | "custom" | "concept_focus";
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
  postWorkMode?: "none" | "custom" | "concept_focus";
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
},
  client?: DbClient,
  options?: TeacherMutationGuardOptions
): Promise<void> {
  const db = client ?? supabase;
  await assertTeacherApprovedForMutations(input.teacherId, db, options);
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

  const postDelayDays =
    Number.isFinite(Number(input.postWorkDelayDays)) && Number(input.postWorkDelayDays) >= 0
      ? Math.floor(Number(input.postWorkDelayDays))
      : 0;

  const preWorkPreview =
    (input.preWorkMode ?? "custom") === "none"
      ? []
      : (input.preWorkMode ?? "custom") === "concept_focus" && input.preWorkConceptRef
      ? [`Concept Focus · ${input.preWorkConceptRef.subtopicName}`]
      : [input.preWork.trim()].filter(Boolean);

  const postWorkPreview =
    (input.postWorkMode ?? "custom") === "none"
      ? []
      : (input.postWorkMode ?? "custom") === "concept_focus" && input.postWorkConceptRef
      ? [`Concept Focus · ${input.postWorkConceptRef.subtopicName}`]
      : [input.postWork.trim()].filter(Boolean);

  /** Canonical copy on `live_sessions.plan_json` (same shape as legacy `session_plan` post). */
  const planContent: Record<string, Json> = {
    preWork: preWorkPreview,
    postWork: postWorkPreview,
    preWorkMode: input.preWorkMode ?? "custom",
    postWorkMode: input.postWorkMode ?? "custom",
    preWorkConceptRef: (input.preWorkConceptRef ?? null) as Json,
    postWorkConceptRef: (input.postWorkConceptRef ?? null) as Json,
    postWorkDelayDays: postDelayDays,
    allowAdhocTrial: input.allowAdhocTrial,
    scheduledAt: scheduledAt.toISOString(),
    durationMinutes: input.durationMinutes,
  };

  const { data: insertedSession, error: sessionError } = await db
    .from("live_sessions")
    .insert({
      classroom_id: input.classroomId,
      section_id: input.sectionId ?? null,
      teacher_id: input.teacherId,
      title: sessionTitle,
      scheduled_at: scheduledAt.toISOString(),
      duration_minutes: input.durationMinutes,
      meet_link: meetLink,
      status: "scheduled",
      plan_json: planContent,
    })
    .select("id")
    .single();
  if (sessionError) throw ensureError(sessionError);
  const liveSessionId = insertedSession.id;

  const { error: planError } = await db.from("posts").insert({
    classroom_id: input.classroomId,
    section_id: input.sectionId ?? null,
    teacher_id: input.teacherId,
    type: "session_plan",
    title: `${sessionTitle} plan`,
    visibility: "classroom",
    description: `Adhoc trial: ${input.allowAdhocTrial ? "Enabled" : "Disabled"}`,
    content_json: planContent,
  });
  if (planError) throw ensureError(planError);

  const sessionEnd = new Date(scheduledAt.getTime() + input.durationMinutes * 60 * 1000);
  const preReleaseAt = new Date().toISOString();
  const postReleaseAt = new Date(
    sessionEnd.getTime() + postDelayDays * 24 * 60 * 60 * 1000 + 1000
  ).toISOString();

  let preAssignmentPostId: string | null = null;
  let postAssignmentPostId: string | null = null;

  // Auto-create PRE-WORK assignment (immediate release, deadline = class start).
  if ((input.preWorkMode ?? "custom") === "none") {
    // no-op
  } else if ((input.preWorkMode ?? "custom") === "concept_focus" && input.preWorkConceptRef) {
    const cq = input.preWorkConceptRef;
    const created = await createClassroomAssignment(
      {
      teacherId: input.teacherId,
      classroomId: input.classroomId,
      sectionId: input.sectionId ?? null,
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
        liveSessionId,
        sessionTitle,
        sessionScheduledAt: scheduledAt.toISOString(),
        sessionDurationMinutes: input.durationMinutes,
      },
      },
      db,
      options
    );
    preAssignmentPostId = created.id;
  } else if (input.preWork.trim()) {
    const created = await createClassroomAssignment(
      {
      teacherId: input.teacherId,
      classroomId: input.classroomId,
      sectionId: input.sectionId ?? null,
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
        liveSessionId,
        sessionTitle,
        sessionScheduledAt: scheduledAt.toISOString(),
        sessionDurationMinutes: input.durationMinutes,
      },
      },
      db,
      options
    );
    preAssignmentPostId = created.id;
  }

  // Auto-create POST-WORK assignment (released after class end + optional day delay).
  if ((input.postWorkMode ?? "custom") === "none") {
    // no-op
  } else if ((input.postWorkMode ?? "custom") === "concept_focus" && input.postWorkConceptRef) {
    const cq = input.postWorkConceptRef;
    const postDueAt = new Date(postReleaseAt).toISOString();
    const created = await createClassroomAssignment(
      {
      teacherId: input.teacherId,
      classroomId: input.classroomId,
      sectionId: input.sectionId ?? null,
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
        liveSessionId,
        sessionTitle,
        postWorkDelayDays: postDelayDays,
        sessionScheduledAt: scheduledAt.toISOString(),
        sessionDurationMinutes: input.durationMinutes,
      },
      },
      db,
      options
    );
    postAssignmentPostId = created.id;
  } else if (input.postWork.trim()) {
    const postDueAt = new Date(postReleaseAt).toISOString();
    const created = await createClassroomAssignment(
      {
      teacherId: input.teacherId,
      classroomId: input.classroomId,
      sectionId: input.sectionId ?? null,
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
        liveSessionId,
        sessionTitle,
        postWorkDelayDays: postDelayDays,
        sessionScheduledAt: scheduledAt.toISOString(),
        sessionDurationMinutes: input.durationMinutes,
      },
      },
      db,
      options
    );
    postAssignmentPostId = created.id;
  }

  const assignmentPatch: {
    pre_assignment_post_id?: string | null;
    post_assignment_post_id?: string | null;
  } = {};
  if (preAssignmentPostId) assignmentPatch.pre_assignment_post_id = preAssignmentPostId;
  if (postAssignmentPostId) assignmentPatch.post_assignment_post_id = postAssignmentPostId;
  if (Object.keys(assignmentPatch).length > 0) {
    const { error: linkErr } = await db
      .from("live_sessions")
      .update(assignmentPatch)
      .eq("id", liveSessionId);
    if (linkErr) throw ensureError(linkErr);
  }
}
