import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { makeSubtopicEngagementStorageKey } from "@/lib/curriculum/subtopicEngagementStorageKey";
import { parseTeacherProfileMetaFromBio, type TeacherProfileDetails } from "@/lib/profile/teacherProfileMeta";
import { appendQueryParams, buildTopicPath } from "@/lib/curriculum/topicRoutes";
import {
  parseAssignmentTasks,
  studentVisibleTasks,
} from "@/lib/classroom/assignmentTasks";
import {
  formatConceptFocusRefForDisplay,
  inferSessionWorkKind,
  postWorkDelayLabel,
} from "@/lib/teacherPortal/sessionWorkDisplay";
import { kolkataWeekRangeMs } from "@/lib/kolkataWeek";
import { parseBitsTestAttemptsStore } from "@/lib/play/bits/parseBitsTestAttemptsStore";
import {
  contentJsonHasGeneratedTestPaper,
  postRowIsNudgeMcqTarget,
  postTimestampMsForNudgeWeek,
} from "@/lib/teacherPortal/nudgeMcqPosts";
import type {
  TeacherPortalClassroomCard,
  TeacherPortalClassroomDetail,
  TeacherPortalDataBundle,
  TeacherPortalMockNudgeLowScorer,
  TeacherPortalMockNudgeSubmittedAttempt,
  TeacherPortalMeetSession,
  TeacherPortalMotivationLogItem,
  TeacherPortalProfileView,
  TeacherPortalReferStats,
  TeacherPortalSessionItem,
  TeacherPortalSessionWorkKind,
  TeacherPortalSummary,
  TeacherVerificationStatus,
  TeacherPortalWallItem,
} from "@/lib/teacherPortal/types";

import {
  asObject,
  asStringArray,
  formatSessionLabel,
  inferNextOccurrenceFromSectionSchedule,
  startOfTodayIso,
  startOfWeekIso,
  type DbClient,
  type InferredCardSession,
  type SectionScheduleInferInput,
} from "./utils";
import {
  parseMockPaperRef,
  parsePastPaperRef,
  parseChapterQuizRef,
  parseDailyDoseStreakRef,
  parseGyanEngagementRef,
} from "./parsers";
import {
  allocateUniqueJoinCode,
  countStudentsAllVisibleTasksDone,
  fetchAllPostsForTeacherClassrooms,
  isTeacherPortalDemoShowcaseClassroom,
} from "./helpers";

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
        "id, classroom_id, section_id, type, created_at, updated_at, title, description, due_date, content_json, teacher_id"
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

  const [memberRowsBase, sessionRows, sectionRowsRes, askerProfilesRes] = await Promise.all([
    classroomIds.length
      ? db
          .from("classroom_members")
          .select("classroom_id, role, section_id")
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

  const postsFromClassrooms =
    classroomIds.length > 0 ? await fetchAllPostsForTeacherClassrooms(db, userId, classroomIds) : [];

  const members = memberRowsBase.data ?? membersRes.data ?? [];
  const posts =
    classroomIds.length > 0 ? postsFromClassrooms : (postsRes.data ?? []);
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
  const assignmentTypes = new Set(["assignment", "quiz", "mock", "past_paper", "Concept Focus"]);
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
      p.type === "past_paper" ||
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

  for (const detail of Object.values(detailMap)) {
    const seen = new Set<string>();
    detail.students = detail.students.filter((s) => {
      if (seen.has(s.userId)) return false;
      seen.add(s.userId);
      return true;
    });
  }

  const assignmentPostIds = assignmentPosts.map((p) => p.id);
  let taskProgressRows: Array<{
    post_id: string;
    task_id: string;
    user_id: string;
    completed_at?: string | null;
  }> = [];
  if (assignmentPostIds.length > 0) {
    const { data: prog, error: progErr } = await db
      .from("classroom_assignment_task_progress")
      .select("post_id, task_id, user_id, completed_at")
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
    bits_test_attempts?: Json | null;
  };

  /** Same normalization as `generated-test-scores` API for chapter-quiz ↔ bits rows. */
  const normalizeBitsLookupKey = (v: unknown): string =>
    String(v ?? "")
      .trim()
      .toLowerCase();

  const studentEngagementByUser = new Map<string, Record<string, unknown>>();
  const bitsAttemptsByUserId = new Map<
    string,
    ReturnType<typeof parseBitsTestAttemptsStore>
  >();
  if (studentIdsAcrossClassrooms.length > 0) {
    const { data: profileRows, error: profileErr } = await db
      .from("profiles")
      .select("id, subtopic_engagement, bits_test_attempts")
      .in("id", studentIdsAcrossClassrooms);

    if (!profileErr && profileRows) {
      for (const row of profileRows as ProfileEngagementRow[]) {
        const raw = row.subtopic_engagement;
        if (raw && typeof raw === "object" && !Array.isArray(raw)) {
          studentEngagementByUser.set(row.id, raw as Record<string, unknown>);
        } else {
          studentEngagementByUser.set(row.id, {});
        }
        bitsAttemptsByUserId.set(row.id, parseBitsTestAttemptsStore(row.bits_test_attempts ?? null));
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
            completed_at: attempt.submitted_at,
          });
        }
      }
    }
  }

  type CgtaBundleRow = {
    classroom_id: string;
    user_id: string;
    submitted_at: string;
    score: number | null;
    total: number | null;
    post_id: string;
    /** Used when `total` is 0 in DB but the row is a real submission (rare client bugs). */
    answers_json?: unknown;
  };

  /** PostgREST defaults to 1000 rows; paginate so nudge + averages see all attempts. */
  const CGTA_PAGE_SIZE = 1000;

  function cgtaEffectiveTotal(row: CgtaBundleRow): number {
    const t = Number(row.total ?? 0);
    if (Number.isFinite(t) && t > 0) return t;
    const aj = row.answers_json;
    if (Array.isArray(aj) && aj.length > 0) return aj.length;
    // Chapter quiz snapshots: { version: 1, items: [...] }
    if (aj && typeof aj === "object" && !Array.isArray(aj)) {
      const items = (aj as { items?: unknown }).items;
      if (Array.isArray(items) && items.length > 0) return items.length;
    }
    return 0;
  }

  const cgtaRowsAll: CgtaBundleRow[] = [];
  if (classroomIds.length > 0) {
    for (let offset = 0; ; offset += CGTA_PAGE_SIZE) {
      const { data: chunk, error: cgtaPageErr } = await (
        db as unknown as {
          from: (t: string) => {
            select: (c: string) => {
              in: (col: string, vals: string[]) => {
                not: (col: string, op: string, v: null) => {
                  order: (col: string, o: { ascending: boolean }) => {
                    range: (a: number, b: number) => Promise<{
                      data: CgtaBundleRow[] | null;
                      error: { message?: string } | null;
                    }>;
                  };
                };
              };
            };
          };
        }
      )
        .from("classroom_generated_test_attempts")
        .select("classroom_id, user_id, submitted_at, score, total, post_id, answers_json")
        .in("classroom_id", classroomIds)
        .not("submitted_at", "is", null)
        .order("submitted_at", { ascending: false })
        .range(offset, offset + CGTA_PAGE_SIZE - 1);
      if (cgtaPageErr) {
        console.warn(
          "[teacher portal] classroom_generated_test_attempts:",
          cgtaPageErr.message ?? cgtaPageErr
        );
        break;
      }
      const rows = (chunk ?? []) as CgtaBundleRow[];
      cgtaRowsAll.push(...rows);
      if (rows.length < CGTA_PAGE_SIZE) break;
    }
  }

  // Chapter quizzes sometimes only appear in `profiles.bits_test_attempts` (same fallback as
  // GET .../generated-test-scores). Merge into bundle rows so nudges + averages match the modal.
  const cgtaPostUserSeen = new Set(cgtaRowsAll.map((r) => `${r.post_id}:${r.user_id}`));
  for (const post of assignmentPosts) {
    if (post.type === "Concept Focus") continue;
    const payload = asObject(post.content_json);
    const cqRaw = payload.chapterQuiz;
    if (!cqRaw || typeof cqRaw !== "object" || Array.isArray(cqRaw)) continue;
    const cq = cqRaw as Record<string, unknown>;
    const expectedSubject = normalizeBitsLookupKey(cq.subject);
    const expectedClass = Number(cq.classLevel);
    const expectedTopic = normalizeBitsLookupKey(cq.topic);
    const expectedSubtopic = normalizeBitsLookupKey(cq.subtopicName);
    if (!expectedSubject || !expectedTopic || !expectedSubtopic) continue;

    const cid = post.classroom_id;
    const detail = detailMap[cid];
    if (!detail) continue;

    for (const s of detail.students) {
      if (s.role === "teacher") continue;
      const pair = `${post.id}:${s.userId}`;
      if (cgtaPostUserSeen.has(pair)) continue;

      const bitsRows = bitsAttemptsByUserId.get(s.userId) ?? [];
      const match = bitsRows
        .filter((r) => {
          return (
            normalizeBitsLookupKey(r.subject) === expectedSubject &&
            Number(r.classLevel) === expectedClass &&
            normalizeBitsLookupKey(r.topic) === expectedTopic &&
            normalizeBitsLookupKey(r.subtopicName) === expectedSubtopic
          );
        })
        .sort((a, b) => (b.submittedAtMs ?? 0) - (a.submittedAtMs ?? 0))[0];
      if (!match || typeof match.submittedAtMs !== "number" || !Number.isFinite(match.submittedAtMs)) {
        continue;
      }

      cgtaRowsAll.push({
        classroom_id: cid,
        user_id: s.userId,
        submitted_at: new Date(match.submittedAtMs).toISOString(),
        score: match.correctCount,
        total: match.totalQuestions,
        post_id: post.id,
      });
      cgtaPostUserSeen.add(pair);
    }
  }

  const lastMsByClassUser = new Map<string, number>();
  const bumpClassroomUserMs = (classroomId: string, userId: string, ms: number) => {
    if (!classroomId || !userId || !Number.isFinite(ms)) return;
    const key = `${classroomId}:${userId}`;
    const prev = lastMsByClassUser.get(key) ?? 0;
    if (ms > prev) lastMsByClassUser.set(key, ms);
  };

  const postClassroomById = new Map(assignmentPosts.map((p) => [p.id, p.classroom_id]));
  for (const r of taskProgressRows) {
    const cid = postClassroomById.get(r.post_id);
    if (!cid) continue;
    const rawAt = r.completed_at;
    if (typeof rawAt === "string" && rawAt.trim()) {
      const t = Date.parse(rawAt);
      if (Number.isFinite(t)) bumpClassroomUserMs(cid, r.user_id, t);
    }
  }
  for (const row of cgtaRowsAll) {
    const t = Date.parse(row.submitted_at);
    if (Number.isFinite(t)) bumpClassroomUserMs(row.classroom_id, row.user_id, t);
  }

  const cutoff30Ms = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const scoreAggByClassUser = new Map<string, { sum: number; n: number }>();
  for (const row of cgtaRowsAll) {
    const t = Date.parse(row.submitted_at);
    if (!Number.isFinite(t) || t < cutoff30Ms) continue;
    const tot = cgtaEffectiveTotal(row);
    if (!Number.isFinite(tot) || tot <= 0) continue;
    const sc = Number(row.score ?? 0);
    const pct = (100 * sc) / tot;
    const key = `${row.classroom_id}:${row.user_id}`;
    const agg = scoreAggByClassUser.get(key) ?? { sum: 0, n: 0 };
    agg.sum += pct;
    agg.n += 1;
    scoreAggByClassUser.set(key, agg);
  }
  const avgPctByClassUser = new Map<string, number>();
  for (const [key, v] of scoreAggByClassUser) {
    if (v.n > 0) avgPctByClassUser.set(key, Math.round((v.sum / v.n) * 10) / 10);
  }

  const nowEngagementMs = Date.now();
  const newMemberGraceMs = 48 * 60 * 60 * 1000;
  for (const c of classrooms) {
    if (isTeacherPortalDemoShowcaseClassroom(c.id, c.name)) continue;
    const detail = detailMap[c.id];
    if (!detail) continue;
    for (const s of detail.students) {
      if (s.role === "teacher") continue;
      const key = `${c.id}:${s.userId}`;
      const lastMs = lastMsByClassUser.get(key);
      const joinedMs = Date.parse(s.joinedAt);
      const lastActiveAt =
        lastMs && Number.isFinite(lastMs) ? new Date(lastMs).toISOString() : null;
      let status: "active" | "off_streak" | "at_risk";
      if (!lastActiveAt) {
        status =
          Number.isFinite(joinedMs) && nowEngagementMs - joinedMs > newMemberGraceMs
            ? "off_streak"
            : "active";
      } else {
        const idleH = (nowEngagementMs - lastMs!) / (60 * 60 * 1000);
        if (idleH >= 48) status = "off_streak";
        else if (idleH >= 24) status = "at_risk";
        else status = "active";
      }
      s.lastActiveAt = lastActiveAt;
      s.status = status;
      s.avgScorePercent = avgPctByClassUser.get(key) ?? null;
    }
  }

  const { startMs: weekStartMs, endMs: weekEndMs } = kolkataWeekRangeMs(new Date());
  const classroomIdSet = new Set(classroomIds);
  const mockPostIdsAssignedThisWeek = assignmentPosts
    .filter((p) => {
      if (!classroomIdSet.has(p.classroom_id)) return false;
      if (!postRowIsNudgeMcqTarget(p)) return false;
      const t = postTimestampMsForNudgeWeek(p);
      return t != null && t >= weekStartMs && t <= weekEndMs;
    })
    .map((p) => p.id);

  const mockPostIdSet = new Set(mockPostIdsAssignedThisWeek);
  const lowScorerBestByPostUser = new Map<string, TeacherPortalMockNudgeLowScorer>();
  for (const row of cgtaRowsAll) {
    if (!mockPostIdSet.has(row.post_id)) continue;
    const tot = cgtaEffectiveTotal(row);
    if (!Number.isFinite(tot) || tot <= 0) continue;
    const sc = Number(row.score ?? 0);
    const pct = (100 * sc) / tot;
    if (pct >= 60) continue;
    const rounded = Math.round(pct * 10) / 10;
    const pKey = `${row.post_id}:${row.user_id}`;
    const prev = lowScorerBestByPostUser.get(pKey);
    if (!prev || rounded < prev.pct) {
      lowScorerBestByPostUser.set(pKey, {
        userId: row.user_id,
        pct: rounded,
        submittedAt: row.submitted_at,
      });
    }
  }
  const mockNudgeLowScorersByPostId: Record<string, TeacherPortalMockNudgeLowScorer[]> = {};
  for (const [pKey, row] of lowScorerBestByPostUser) {
    const postId = pKey.split(":")[0];
    if (!postId) continue;
    const list = mockNudgeLowScorersByPostId[postId] ?? [];
    list.push(row);
    mockNudgeLowScorersByPostId[postId] = list;
  }

  /** Latest attempt per student per post (for wizard: show who submitted even when all scored ≥60%). */
  const submittedLatestByPostUser = new Map<
    string,
    { userId: string; pct: number; submittedAt: string }
  >();
  for (const row of cgtaRowsAll) {
    if (!mockPostIdSet.has(row.post_id)) continue;
    const tot = cgtaEffectiveTotal(row);
    if (!Number.isFinite(tot) || tot <= 0) continue;
    const sc = Number(row.score ?? 0);
    const pct = Math.round(((100 * sc) / tot) * 10) / 10;
    const key = `${row.post_id}:${row.user_id}`;
    const t = Date.parse(row.submitted_at);
    if (!Number.isFinite(t)) continue;
    const prev = submittedLatestByPostUser.get(key);
    if (!prev || t > Date.parse(prev.submittedAt)) {
      submittedLatestByPostUser.set(key, {
        userId: row.user_id,
        pct,
        submittedAt: row.submitted_at,
      });
    }
  }
  const mockNudgeSubmittedAttemptsByPostId: Record<
    string,
    TeacherPortalMockNudgeSubmittedAttempt[]
  > = {};
  for (const [puKey, attempt] of submittedLatestByPostUser) {
    const colon = puKey.indexOf(":");
    if (colon <= 0) continue;
    const postId = puKey.slice(0, colon);
    const arr = mockNudgeSubmittedAttemptsByPostId[postId] ?? [];
    arr.push(attempt);
    mockNudgeSubmittedAttemptsByPostId[postId] = arr;
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
    const isGeneratedClassroomMcq =
      post.type === "assignment" && contentJsonHasGeneratedTestPaper(post.content_json);
    detail.assignments.push({
      id: post.id,
      title:
        post.title ||
        (post.type === "mock"
          ? "Full Physics Mock — JEE Pattern"
          : post.type === "past_paper"
            ? "Past Paper — JEE Pattern"
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
      ...(isGeneratedClassroomMcq ? { isGeneratedClassroomMcq: true } : {}),
      ...(post.type === "mock" ? { mockPaper: parseMockPaperRef(payload) ?? null } : {}),
      ...(post.type === "past_paper" ? { pastPaper: parsePastPaperRef(payload) ?? null } : {}),
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
    mockPostIdsAssignedThisWeek,
    mockNudgeLowScorersByPostId,
    mockNudgeSubmittedAttemptsByPostId,
  };
}
