"use client";

import { useCallback, useLayoutEffect, useState } from "react";
import type { AssignmentTaskStored } from "@/lib/classroom/assignmentTasks";
import type { Json } from "@/integrations/supabase/types";
import { safeGetSession } from "@/lib/auth/safeSession";
import type { MotivationNudgeGoal, MotivationRecommendActionId } from "@/lib/teacherPortal/queries";
import type {
  TeacherPortalChapterQuizRef,
  TeacherPortalDailyDoseStreakRef,
  TeacherPortalDataBundle,
  TeacherPortalGyanEngagementRef,
  TeacherPortalMockPaperRef,
} from "@/lib/teacherPortal/types";

const DEFAULT_ADMIN_NOTES = "Admin Teacher Portal action";

async function adminFetch(path: string, init?: RequestInit) {
  const { session } = await safeGetSession();
  if (!session?.access_token) throw new Error("Missing access token");
  return fetch(path, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${session.access_token}`,
    },
    cache: "no-store",
  });
}

interface UseAdminTeacherPortalDataResult {
  data: TeacherPortalDataBundle | null;
  loading: boolean;
  error: string | null;
  refresh: (opts?: { silent?: boolean }) => Promise<void>;
  saveProfile: (input: {
    userId: string;
    name: string;
    bio: string;
    visibility: string;
    subjects: string[];
    examTags: string[];
    teachingLevels: number[];
    avatarUrl?: string | null;
    details?: Record<string, unknown>;
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
    preWorkConceptRef?: Record<string, unknown> | null;
    postWorkMode?: "none" | "custom" | "concept_focus";
    postWorkConceptRef?: Record<string, unknown> | null;
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

export function useAdminTeacherPortalData(
  teacherId: string | null | undefined
): UseAdminTeacherPortalDataResult {
  const [data, setData] = useState<TeacherPortalDataBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!teacherId) return;
      const silent = Boolean(opts?.silent);
      if (!silent) setLoading(true);
      setError(null);
      try {
        const res = await adminFetch(`/api/admin/teachers/${teacherId}/bundle`);
        const body = (await res.json()) as { bundle?: TeacherPortalDataBundle; error?: string };
        if (!res.ok) throw new Error(body.error || "Could not load teacher portal bundle.");
        const b = body.bundle;
        setData(
          b
            ? {
                ...b,
                mockPostIdsAssignedThisWeek: b.mockPostIdsAssignedThisWeek ?? [],
                mockNudgeLowScorersByPostId: b.mockNudgeLowScorersByPostId ?? {},
                mockNudgeSubmittedAttemptsByPostId: b.mockNudgeSubmittedAttemptsByPostId ?? {},
              }
            : null
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load teacher portal bundle.");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [teacherId]
  );

  useLayoutEffect(() => {
    if (!teacherId) {
      setData(null);
      return;
    }
    void refresh();
  }, [teacherId, refresh]);

  const createClassroom = useCallback(
    async (
      input: UseAdminTeacherPortalDataResult["createClassroom"] extends (a: infer A) => any
        ? A
        : never
    ) => {
      if (!teacherId) throw new Error("Missing teacherId");
      const res = await adminFetch(`/api/admin/teachers/${teacherId}/classrooms/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, notes: DEFAULT_ADMIN_NOTES }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error || "Failed to create classroom");
      await refresh();
    },
    [teacherId, refresh]
  );

  const updateClassroom = useCallback(
    async (
      input: UseAdminTeacherPortalDataResult["updateClassroom"] extends (a: infer A) => any
        ? A
        : never
    ) => {
      if (!teacherId) throw new Error("Missing teacherId");
      const res = await adminFetch(`/api/admin/teachers/${teacherId}/classrooms/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, notes: DEFAULT_ADMIN_NOTES }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error || "Failed to update classroom");
      await refresh();
    },
    [teacherId, refresh]
  );

  const deleteClassroom = useCallback(
    async (
      input: UseAdminTeacherPortalDataResult["deleteClassroom"] extends (a: infer A) => any
        ? A
        : never
    ) => {
      if (!teacherId) throw new Error("Missing teacherId");
      const res = await adminFetch(`/api/admin/teachers/${teacherId}/classrooms/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, notes: DEFAULT_ADMIN_NOTES }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error || "Failed to delete classroom");
      await refresh();
    },
    [teacherId, refresh]
  );

  const saveProfile = useCallback(
    async (
      input: UseAdminTeacherPortalDataResult["saveProfile"] extends (a: infer A) => any ? A : never
    ) => {
      if (!teacherId) throw new Error("Missing teacherId");
      const res = await adminFetch(`/api/admin/teachers/${teacherId}/profile/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, notes: DEFAULT_ADMIN_NOTES }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error || "Failed to update profile");
      await refresh();
    },
    [teacherId, refresh]
  );

  const createAssignment = useCallback(
    async (
      input: UseAdminTeacherPortalDataResult["createAssignment"] extends (a: infer A) => any
        ? A
        : never
    ) => {
      if (!teacherId) throw new Error("Missing teacherId");
      const res = await adminFetch(`/api/admin/teachers/${teacherId}/assignments/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, notes: DEFAULT_ADMIN_NOTES }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; id?: string };
      if (!res.ok) throw new Error(body.error || "Failed to create assignment");
      const postId = typeof body.id === "string" ? body.id.trim() : "";
      if (!postId) throw new Error("Assignment created but id was not returned.");
      await refresh();
      return { id: postId };
    },
    [teacherId, refresh]
  );

  const createSession = useCallback(
    async (
      input: UseAdminTeacherPortalDataResult["createSession"] extends (a: infer A) => any
        ? A
        : never
    ) => {
      if (!teacherId) throw new Error("Missing teacherId");
      const res = await adminFetch(`/api/admin/teachers/${teacherId}/sessions/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, notes: DEFAULT_ADMIN_NOTES }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error || "Failed to create session");
      await refresh();
    },
    [teacherId, refresh]
  );

  const motivateStudents = useCallback(
    async (
      input: UseAdminTeacherPortalDataResult["motivateStudents"] extends (a: infer A) => any
        ? A
        : never
    ) => {
      if (!teacherId) throw new Error("Missing teacherId");
      const res = await adminFetch(`/api/admin/teachers/${teacherId}/motivation/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, notes: DEFAULT_ADMIN_NOTES }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error || "Failed to send motivation");
      await refresh();
    },
    [teacherId, refresh]
  );

  const rewardTopStudents = useCallback(
    async (
      input: UseAdminTeacherPortalDataResult["rewardTopStudents"] extends (a: infer A) => any
        ? A
        : never
    ) => {
      if (!teacherId) throw new Error("Missing teacherId");
      const res = await adminFetch(`/api/admin/teachers/${teacherId}/motivation/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...input,
          actionKind: "reward_top_students",
          notes: DEFAULT_ADMIN_NOTES,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error || "Failed to reward students");
      await refresh();
    },
    [teacherId, refresh]
  );

  return {
    data,
    loading,
    error,
    refresh,
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
