import type { AdvancedQuizSetIndex } from "@/lib/play/quiz/advancedQuizSets";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import {
  serializeTeacherProfileMetaToBio,
  type TeacherProfileDetails,
} from "@/lib/profile/teacherProfileMeta";
import { appendQueryParams, buildTopicPath } from "@/lib/curriculum/topicRoutes";
import {
  buildDefaultTasksForAssignmentType,
  normalizeTaskPositions,
  serializeTasksForContentJson,
  type AssignmentTaskStored,
} from "@/lib/classroom/assignmentTasks";
import {
  isDailyDoseStreakTrackId,
  playHrefForDailyDoseStreak,
  trackLabelById,
  type DailyDoseStreakTrackId,
} from "@/lib/teacherPortal/dailyDoseStreakTracks";
import {
  hrefContainsPostIdTemplate,
  resolvePostIdInHref,
} from "@/lib/teacherPortal/assignmentPostIdTemplate";
import type { StudentMessageKind } from "@/lib/teacherPortal/studentNotificationCopy";
import type {
  TeacherPortalChapterQuizRef,
  TeacherPortalDailyDoseStreakRef,
  TeacherPortalGyanEngagementRef,
  TeacherPortalMockPaperRef,
  TeacherPortalMotivationLogItem,
  TeacherPortalPastPaperRef,
  TeacherVerificationStatus,
} from "@/lib/teacherPortal/types";

import {
  ensureError,
  hasIdentityDocs,
  hasValue,
  isValidIndianPhone,
  normalizeIndianPhone,
  asObject,
  asStringArray,
  type DbClient,
} from "./utils";
import { allocateUniqueJoinCode } from "./helpers";
import { assertTeacherApprovedForMutations, type TeacherMutationGuardOptions } from "./guards";
import { assertTeacherCanCreateAssignmentWithDb } from "@/lib/teacherPortal/teacherPlanQuota";

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
        eq: (
          c: string,
          v: string
        ) => {
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
    (prevTeacherDetails as { verified_contact_email?: string | null } | null)
      ?.verified_contact_email ?? ""
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
  const endNote = input.scheduleEndDate?.trim()
    ? `End date: ${input.scheduleEndDate.trim()}`
    : "End date: open-ended";
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
    /** Selected catalog paper for `past_paper` assignments */
    pastPaper?: TeacherPortalPastPaperRef | null;
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
  if (!options?.skipPlanQuotaCheck) {
    await assertTeacherCanCreateAssignmentWithDb(input.teacherId, db);
  }
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
            href: mock.slug ? `/mock-test?paper=${encodeURIComponent(mock.slug)}` : "/mock-test",
          }
        : t
    );
  }
  const past = input.pastPaper;
  if (past && input.assignmentType === "past_paper") {
    taskList = taskList.map((t) =>
      t.kind === "past_paper"
        ? {
            ...t,
            label: past.title,
            href: past.slug ? `/mock-test?paper=${encodeURIComponent(past.slug)}` : "/mock-test",
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
    const focus = sub || topic || "today's class topic";
    const gyanTask = taskList.find((t) => t.kind === "gyan_engagement");
    const href = gyanTask
      ? appendQueryParams("/doubts", {
          ask: "1",
          postId: "{{POST_ID}}",
          classroomId: input.classroomId,
          taskId: gyanTask.id,
        })
      : "/doubts?ask=1";
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
    pastPaper: past ? { id: past.id, slug: past.slug, title: past.title } : null,
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
      description:
        input.rewardRdm > 0
          ? `Assign to: ${input.assignToLabel} | Completion reward: +${input.rewardRdm} RDM per student | Notes: ${input.instructions.trim() || "None"}`
          : `Assign to: ${input.assignToLabel} | No completion reward | Notes: ${input.instructions.trim() || "None"}`,
      due_date: dueDateIso,
      content_json: mergedContentJson,
    })
    .select("id, content_json")
    .single();
  if (error) throw error;

  // Resolve {{POST_ID}} placeholders after insert (stored hrefs are often URL-encoded).
  if (insertedPost) {
    const existing =
      insertedPost.content_json && typeof insertedPost.content_json === "object"
        ? (insertedPost.content_json as Record<string, Json>)
        : {};
    const existingTasks = Array.isArray(existing.tasks) ? existing.tasks : [];
    const needsResolve = existingTasks.some((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
      const href = (entry as Record<string, unknown>).href;
      return typeof href === "string" && hrefContainsPostIdTemplate(href);
    });
    if (needsResolve) {
      const resolvedTasks = existingTasks.map((entry) => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) return entry;
        const task = { ...(entry as Record<string, Json>) };
        const href = task.href;
        if (typeof href === "string" && hrefContainsPostIdTemplate(href)) {
          task.href = resolvePostIdInHref(href, insertedPost.id);
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
    }
  }

  return { id: insertedPost!.id };
}

/** Wizard goal stored on motivation posts for student notification titles and routing. */
export type MotivationNudgeGoal =
  | "restart_streak"
  | "complete_pending_assignment"
  | "attempt_mock"
  | "answer_doubts"
  | "revise_chapter"
  | "watch_recorded_class";

export type MotivationRecommendActionId =
  | "attempt_targeted_mock"
  | "post_doubt"
  | "watch_recorded"
  | "concept_focus_resource"
  | "none";

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
    recommendActionId?: MotivationRecommendActionId;
    recommendActionLabel?: string;
    recommendActionUrl?: string;
    /** Short title shown in the student notification bell (optional for legacy rows). */
    notificationTitle?: string;
    nudgeGoal?: MotivationNudgeGoal;
    studentMessageKind?: StudentMessageKind;
  },
  client?: DbClient,
  options?: TeacherMutationGuardOptions
): Promise<void> {
  const db = client ?? supabase;
  await assertTeacherApprovedForMutations(input.teacherId, db, options);
  const trimmedNotificationTitle = input.notificationTitle?.trim();
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
      ...(trimmedNotificationTitle ? { notificationTitle: trimmedNotificationTitle } : {}),
      ...(input.nudgeGoal ? { nudgeGoal: input.nudgeGoal } : {}),
      ...(input.studentMessageKind ? { studentMessageKind: input.studentMessageKind } : {}),
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
        instructions:
          input.preWork.trim() || "Complete concept-focus pre-work before class starts.",
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
