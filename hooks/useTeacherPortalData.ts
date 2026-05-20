"use client";

import { useCallback, useLayoutEffect, useState } from "react";
import type { AssignmentTaskStored } from "@/lib/classroom/assignmentTasks";
import type { Json } from "@/integrations/supabase/types";
import { fetchWithClientAuth } from "@/lib/auth/clientApiAuth";
import { chargeTeacherRdm, refundTeacherRdm } from "@/lib/teacherPortal/rdmCharges";
import {
  DEFAULT_TEACHER_RDM_COSTS,
  type TeacherRdmCosts,
} from "@/lib/teacherPortal/teacherRdmConfig";
import {
  createClassroomAssignment,
  createTeacherLiveSession,
  createMotivationAction,
  createRewardTopStudentsAction,
  createTeacherClassroom,
  deleteTeacherClassroom,
  loadTeacherPortalBundle,
  updateTeacherClassroom,
  postTeacherSection,
  updateTeacherProfile,
  type MotivationNudgeGoal,
  type MotivationRecommendActionId,
} from "@/lib/teacherPortal/queries";
import type {
  TeacherPortalChapterQuizRef,
  TeacherPortalDailyDoseStreakRef,
  TeacherPortalDataBundle,
  TeacherPortalGyanEngagementRef,
  TeacherPortalMockPaperRef,
} from "@/lib/teacherPortal/types";

const TEACHER_PORTAL_BUNDLE_SNAPSHOT_PREFIX = "teacherPortal.bundleSnapshot.v1:";

function persistTeacherPortalBundleSnapshot(userId: string, bundle: TeacherPortalDataBundle) {
  try {
    sessionStorage.setItem(`${TEACHER_PORTAL_BUNDLE_SNAPSHOT_PREFIX}${userId}`, JSON.stringify(bundle));
  } catch {
    // Quota / private mode
  }
}

function readTeacherPortalBundleSnapshot(userId: string): TeacherPortalDataBundle | null {
  try {
    const raw = sessionStorage.getItem(`${TEACHER_PORTAL_BUNDLE_SNAPSHOT_PREFIX}${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TeacherPortalDataBundle;
    if (!parsed || !Array.isArray(parsed.classrooms)) return null;
    return {
      ...parsed,
      mockPostIdsAssignedThisWeek: parsed.mockPostIdsAssignedThisWeek ?? [],
      mockNudgeLowScorersByPostId: parsed.mockNudgeLowScorersByPostId ?? {},
      mockNudgeSubmittedAttemptsByPostId: parsed.mockNudgeSubmittedAttemptsByPostId ?? {},
    };
  } catch {
    return null;
  }
}

interface UseTeacherPortalDataResult {
  data: TeacherPortalDataBundle | null;
  loading: boolean;
  error: string | null;
  /** Pass `{ silent: true }` to reload data without toggling the full-page loading state (for polling). */
  refresh: (opts?: { silent?: boolean }) => Promise<void>;
  submitTeacherSection: (input: {
    doubtId: string;
    teacherId: string;
    body: string;
  }) => Promise<void>;
  saveProfile: (input: {
    userId: string;
    name: string;
    bio: string;
    visibility: string;
    subjects: string[];
    examTags: string[];
    teachingLevels: number[];
    avatarUrl?: string | null;
    details?: {
      location?: string;
      qualification?: string;
      experience?: string;
      email?: string;
      phone?: string;
      youtubeOrSocial?: string;
      docs?: {
        aadharPhotoUrl?: string;
        aadharShareLink?: string;
        instituteCertificatePhotoUrl?: string;
        instituteCertificateShareLink?: string;
      };
    };
  }) => Promise<void>;
  createClassroom: (input: {
    userId: string;
    name: string;
    subject: string;
    pucLevel: "PUC 1" | "PUC 2" | "Both";
    examTarget: string;
    scheduleDate: string | null;
    scheduleTime: string | null;
    durationMinutes: number;
    repeatDays: string[];
    scheduleEndDate?: string | null;
    allowAdhocTrial: boolean;
  }) => Promise<void>;
  createAssignment: (input: {
    teacherId: string;
    classroomId: string;
    assignmentType: string;
    title: string;
    dueDate: string | null;
    assignToLabel: string;
    targetStudentIds?: string[] | null;
    rewardRdm: number;
    instructions: string;
    tasks?: AssignmentTaskStored[];
    mockPaper?: TeacherPortalMockPaperRef | null;
    chapterQuiz?: TeacherPortalChapterQuizRef | null;
    dailyDoseStreak?: TeacherPortalDailyDoseStreakRef | null;
    gyanEngagement?: TeacherPortalGyanEngagementRef | null;
    extraContentJson?: Record<string, Json> | null;
  }) => Promise<{ id: string }>;
  motivateStudents: (input: {
    teacherId: string;
    classroomId: string;
    actionKind: "boost" | "nudge" | "urgent_nudge";
    targetStudentIds: string[];
    message: string;
    rdmDelta: number;
    sectionId?: string | null;
    relatedPostId?: string;
    relatedPostTitle?: string;
    recommendActionId?: MotivationRecommendActionId;
    recommendActionLabel?: string;
    recommendActionUrl?: string;
    notificationTitle?: string;
    nudgeGoal?: MotivationNudgeGoal;
  }) => Promise<void>;
  rewardTopStudents: (input: {
    teacherId: string;
    classroomId: string;
    targetStudentIds: string[];
    message: string;
    rdmDelta: number;
  }) => Promise<void>;
  createSession: (input: {
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
  }) => Promise<void>;
  updateClassroom: (input: {
    teacherId: string;
    classroomId: string;
    name: string;
    subject: string | null;
    section: string | null;
    introVideoUrl?: string | null;
  }) => Promise<void>;
  deleteClassroom: (input: { teacherId: string; classroomId: string }) => Promise<void>;
}

export function useTeacherPortalData(
  userId: string | null | undefined,
  options?: {
    rdmCosts?: TeacherRdmCosts;
  }
): UseTeacherPortalDataResult {
  const rdmCosts = options?.rdmCosts ?? DEFAULT_TEACHER_RDM_COSTS;
  const [data, setData] = useState<TeacherPortalDataBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!userId) return;
      const silent = Boolean(opts?.silent);
      if (!silent) setLoading(true);
      setError(null);
      try {
        const next = await loadTeacherPortalBundle(userId);
        setData(next);
        persistTeacherPortalBundleSnapshot(userId, next);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load teacher portal.");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [userId]
  );

  useLayoutEffect(() => {
    if (!userId) {
      setData(null);
      return;
    }
    const cached = readTeacherPortalBundleSnapshot(userId);
    if (cached) setData(cached);
    if (cached) void refresh({ silent: true });
    else void refresh();
  }, [userId, refresh]);

  const submitTeacherSection = useCallback(
    async (input: { doubtId: string; teacherId: string; body: string }) => {
      await postTeacherSection(input);
      await refresh();
    },
    [refresh]
  );

  const saveProfile = useCallback(
    async (input: {
      userId: string;
      name: string;
      bio: string;
      visibility: string;
      subjects: string[];
      examTags: string[];
      teachingLevels: number[];
      avatarUrl?: string | null;
      details?: {
        location?: string;
        qualification?: string;
        experience?: string;
        email?: string;
        phone?: string;
        youtubeOrSocial?: string;
        docs?: {
          aadharPhotoUrl?: string;
          aadharShareLink?: string;
          instituteCertificatePhotoUrl?: string;
          instituteCertificateShareLink?: string;
        };
      };
    }) => {
      await updateTeacherProfile(input);
      await refresh();
    },
    [refresh]
  );

  const createClassroom = useCallback(
    async (input: {
      userId: string;
      name: string;
      subject: string;
      pucLevel: "PUC 1" | "PUC 2" | "Both";
      examTarget: string;
      scheduleDate: string | null;
      scheduleTime: string | null;
      durationMinutes: number;
      repeatDays: string[];
      scheduleEndDate?: string | null;
      allowAdhocTrial: boolean;
    }) => {
      await chargeTeacherRdm("create_classroom", rdmCosts);
      let classroomId: string;
      try {
        ({ classroomId } = await createTeacherClassroom(input));
      } catch (e) {
        await refundTeacherRdm("create_classroom", rdmCosts).catch(() => {});
        throw e;
      }
      if (input.scheduleDate && input.scheduleTime) {
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        try {
          const res = await fetchWithClientAuth(`/api/integrations/google/classrooms/${classroomId}/recurring`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              timeZone,
              scheduleDate: input.scheduleDate,
              scheduleTime: input.scheduleTime,
              durationMinutes: input.durationMinutes,
              repeatDays: input.repeatDays,
              scheduleEndDate: input.scheduleEndDate?.trim() || null,
            }),
          });
          const payload = (await res.json().catch(() => ({}))) as { error?: string; skipped?: boolean };
          if (!res.ok && res.status !== 409) {
            console.warn("[google calendar] sync:", payload.error ?? res.status);
          }
        } catch (e) {
          console.warn("[google calendar] sync:", e);
        }
      }
      await refresh();
    },
    [refresh, rdmCosts]
  );

  const createAssignment = useCallback(
    async (input: {
      teacherId: string;
      classroomId: string;
      sectionId?: string | null;
      assignmentType: string;
      title: string;
      dueDate: string | null;
      assignToLabel: string;
      targetStudentIds?: string[] | null;
      rewardRdm: number;
      instructions: string;
      tasks?: AssignmentTaskStored[];
      mockPaper?: TeacherPortalMockPaperRef | null;
      chapterQuiz?: TeacherPortalChapterQuizRef | null;
      dailyDoseStreak?: TeacherPortalDailyDoseStreakRef | null;
      gyanEngagement?: TeacherPortalGyanEngagementRef | null;
      extraContentJson?: Record<string, Json> | null;
    }) => {
      await chargeTeacherRdm("create_assignment", rdmCosts);
      try {
        const created = await createClassroomAssignment(input);
        await refresh();
        return created;
      } catch (e) {
        await refundTeacherRdm("create_assignment", rdmCosts).catch(() => {});
        throw e;
      }
    },
    [refresh, rdmCosts]
  );

  const motivateStudents = useCallback(
    async (input: {
      teacherId: string;
      classroomId: string;
      sectionId?: string | null;
      actionKind: "boost" | "nudge" | "urgent_nudge";
      targetStudentIds: string[];
      message: string;
      rdmDelta: number;
      relatedPostId?: string;
      relatedPostTitle?: string;
      recommendActionId?: MotivationRecommendActionId;
      recommendActionLabel?: string;
      recommendActionUrl?: string;
      notificationTitle?: string;
      nudgeGoal?: MotivationNudgeGoal;
    }) => {
      await createMotivationAction(input);
      await refresh();
    },
    [refresh]
  );

  const rewardTopStudents = useCallback(
    async (input: {
      teacherId: string;
      classroomId: string;
      sectionId?: string | null;
      targetStudentIds: string[];
      message: string;
      rdmDelta: number;
    }) => {
      await createRewardTopStudentsAction(input);
      await refresh();
    },
    [refresh]
  );

  const createSession = useCallback(
    async (input: {
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
    }) => {
      await chargeTeacherRdm("schedule_session", rdmCosts);
      try {
        await createTeacherLiveSession(input);
        await refresh();
      } catch (e) {
        await refundTeacherRdm("schedule_session", rdmCosts).catch(() => {});
        throw e;
      }
    },
    [refresh, rdmCosts]
  );

  const updateClassroom = useCallback(
    async (input: {
      teacherId: string;
      classroomId: string;
      name: string;
      subject: string | null;
      section: string | null;
      introVideoUrl?: string | null;
    }) => {
      await updateTeacherClassroom(input);
      await refresh();
    },
    [refresh]
  );

  const deleteClassroom = useCallback(
    async (input: { teacherId: string; classroomId: string }) => {
      await deleteTeacherClassroom(input);
      await refresh();
    },
    [refresh]
  );

  return {
    data,
    loading,
    error,
    refresh,
    submitTeacherSection,
    saveProfile,
    createClassroom,
    createAssignment,
    motivateStudents,
    rewardTopStudents,
    createSession,
    updateClassroom,
    deleteClassroom,
  };
}
