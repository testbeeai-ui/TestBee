"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/hooks/useAuth";
import { useTeacherPortalData } from "@/hooks/useTeacherPortalData";
import { useTeacherPortalBundleAutoRefresh } from "@/hooks/useTeacherPortalBundleAutoRefresh";
import { useAdminTeacherPortalData } from "@/hooks/useAdminTeacherPortalData";
import type { TeacherPortalSection } from "@/lib/teacherPortal/types";
import TeacherPortalShell from "@/components/teacher-portal/shell/TeacherPortalShell";
import MyClassroomView from "@/components/teacher-portal/classroom/my-classroom/MyClassroomView";
import MyClassesView from "@/components/teacher-portal/views/classes/MyClassesView";
import GyanWallView from "@/components/teacher-portal/views/gyan/GyanWallView";
import ReferEarnView from "@/components/teacher-portal/views/refer/ReferEarnView";
import TeacherProfileView from "@/components/teacher-portal/views/profile/TeacherProfileView";
import CreateTestsView from "@/components/teacher-portal/views/tests/CreateTestsView";
import TeacherVerificationGate from "@/components/teacher-portal/shell/TeacherVerificationGate";
import { useToast } from "@/hooks/use-toast";
import { useTeacherVerificationActionGuard } from "@/hooks/useTeacherVerificationActionGuard";
import { TEACHER_VERIFICATION_REQUIRED_ERROR } from "@/lib/teacherPortal/queries";
import { TEACHER_PORTAL_CLASSROOMS_URL } from "@/lib/teacherPortal/routes";
import { TeacherRdmCostsProvider, useTeacherRdmCosts } from "@/hooks/TeacherRdmCostsContext";

function TeacherPortalPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { user, profile, loading: authLoading } = useAuth();
  const normalizedRole = (profile?.role ?? "").toLowerCase().trim();
  const isTeacherRole = normalizedRole === "teacher";
  const isAdminRole = normalizedRole === "admin";
  const [section, setSection] = useState<TeacherPortalSection>("myClassroom");
  const adminTeacherIdRaw = searchParams.get("adminTeacherId")?.trim() ?? "";
  const isAdminImpersonation = Boolean(adminTeacherIdRaw) && profile?.role === "admin";
  const targetTeacherId = isAdminImpersonation ? adminTeacherIdRaw : (user?.id ?? null);
  const { costs: teacherRdmCosts } = useTeacherRdmCosts();

  const {
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
  } = useTeacherPortalData(!isAdminImpersonation ? user?.id : null, {
    rdmCosts: teacherRdmCosts,
  });

  const adminData = useAdminTeacherPortalData(isAdminImpersonation ? adminTeacherIdRaw : null);
  const activeHook = useMemo(() => {
    return isAdminImpersonation
      ? {
          data: adminData.data,
          loading: adminData.loading,
          error: adminData.error,
          refresh: adminData.refresh,
          // Teacher-only capabilities (gyan wall posting/profile save) are not supported in admin-open mode yet.
          submitTeacherSection: async () => {},
          saveProfile: adminData.saveProfile,
          createClassroom: adminData.createClassroom,
          createAssignment: adminData.createAssignment,
          motivateStudents: adminData.motivateStudents,
          rewardTopStudents: adminData.rewardTopStudents,
          createSession: adminData.createSession,
          updateClassroom: adminData.updateClassroom,
          deleteClassroom: adminData.deleteClassroom,
        }
      : {
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
  }, [
    isAdminImpersonation,
    adminData,
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
  ]);

  const sectionParam = searchParams.get("section");
  const editParam = searchParams.get("edit");
  const autoEditProfile = editParam === "1";
  const paramSection =
    sectionParam === "myClassroom" ||
    sectionParam === "myClasses" ||
    sectionParam === "gyanWall" ||
    sectionParam === "createTests" ||
    sectionParam === "referEarn" ||
    sectionParam === "profile"
      ? sectionParam
      : null;
  const activeSection = (paramSection ?? section) as TeacherPortalSection;

  /** Keep `section` query in sync so `activeSection` (URL-first) matches the tab you clicked. */
  const handleSectionChange = useCallback(
    (next: TeacherPortalSection) => {
      setSection(next);
      const params = new URLSearchParams(searchParams.toString());
      params.set("section", next);
      if (next !== "myClassroom") {
        params.delete("wizard");
        params.delete("classroom");
        params.delete("portalDetail");
        params.delete("google");
        params.delete("reason");
      }
      const qs = params.toString();
      router.replace(qs ? `/teacher-portal?${qs}` : "/teacher-portal");
    },
    [router, searchParams]
  );
  const verificationStatus = activeHook.data?.profile.details.verificationStatus ?? "unverified";

  useTeacherPortalBundleAutoRefresh({
    teacherUserId: targetTeacherId,
    enabled: Boolean(activeHook.data),
    skipRealtime: isAdminImpersonation,
    refresh: activeHook.refresh,
  });

  const { guardAction, isGateOpen, blockedActionLabel, closeGate } =
    useTeacherVerificationActionGuard({
      verificationStatus,
      isAdminImpersonation,
    });
  useEffect(() => {
    if (isGateOpen && verificationStatus === "approved") {
      closeGate();
    }
  }, [closeGate, isGateOpen, verificationStatus]);

  useEffect(() => {
    if (!user || authLoading) return;
    if (isAdminImpersonation || isTeacherRole) return;
    if (isAdminRole && !adminTeacherIdRaw) {
      router.replace("/admin/teacher-portal");
      return;
    }
    router.replace("/home");
  }, [
    user,
    authLoading,
    isAdminImpersonation,
    isTeacherRole,
    isAdminRole,
    adminTeacherIdRaw,
    router,
  ]);

  const handleOpenVerificationProfile = useCallback(() => {
    setSection("profile");
    closeGate();
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("section", "profile");
    nextParams.set("edit", "1");
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `/teacher-portal?${nextQuery}` : TEACHER_PORTAL_CLASSROOMS_URL);
  }, [closeGate, router, searchParams]);

  const handleRefreshVerificationStatus = useCallback(async () => {
    await activeHook.refresh();
  }, [activeHook]);
  const requireVerifiedAction = useCallback(
    async <T,>(action: () => Promise<T>, actionLabel: string): Promise<T> => {
      const result = await guardAction(action, { actionLabel });
      if (result === null) {
        throw new Error(TEACHER_VERIFICATION_REQUIRED_ERROR);
      }
      return result;
    },
    [guardAction]
  );

  if (!user) {
    return (
      <ProtectedRoute>
        <div />
      </ProtectedRoute>
    );
  }

  if (authLoading) {
    return (
      <ProtectedRoute>
        <div className="flex min-h-screen items-center justify-center bg-[#07070f] text-slate-200">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" aria-hidden />
        </div>
      </ProtectedRoute>
    );
  }

  if (!isAdminImpersonation && !isTeacherRole) {
    return (
      <ProtectedRoute>
        <div className="flex min-h-screen items-center justify-center bg-[#07070f] text-slate-200">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" aria-hidden />
        </div>
      </ProtectedRoute>
    );
  }

  const teacherName =
    activeHook.data?.profile.name ??
    (isAdminImpersonation ? "Teacher" : (profile?.name ?? "Teacher"));
  const teacherSubtitle = activeHook.data?.profile?.subjects.join(" · ") || "EduBlast Teacher";
  const rdmBalance =
    activeHook.data?.profile.rdm ?? (isAdminImpersonation ? 0 : (profile?.rdm ?? 0));

  return (
    <ProtectedRoute>
      <TeacherPortalShell
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
        rdmBalance={rdmBalance}
        teacherName={teacherName}
        teacherSubtitle={teacherSubtitle}
        onOpenCreateTests={() => handleSectionChange("createTests")}
      >
        {activeHook.loading && !activeHook.data ? (
          <div className="flex min-h-[50vh] items-center justify-center gap-2 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading teacher portal...
          </div>
        ) : activeHook.error ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
            {activeHook.error}
          </div>
        ) : activeHook.data ? (
          <>
            {activeSection === "myClassroom" ? (
              <MyClassroomView
                summary={activeHook.data.summary}
                classrooms={activeHook.data.classrooms}
                classroomDetails={activeHook.data.classroomDetails}
                mockPostIdsAssignedThisWeek={activeHook.data.mockPostIdsAssignedThisWeek}
                mockNudgeLowScorersByPostId={activeHook.data.mockNudgeLowScorersByPostId}
                mockNudgeSubmittedAttemptsByPostId={
                  activeHook.data.mockNudgeSubmittedAttemptsByPostId
                }
                allowNudgeStructuredAssignmentCreate={!isAdminImpersonation}
                teacherId={targetTeacherId ?? ""}
                onRefreshTeacherPortal={activeHook.refresh}
                onRequireVerifiedAction={async (actionLabel) => {
                  const result = await guardAction(async () => true, { actionLabel });
                  return result === true;
                }}
                onCreateClassroom={async (input) => {
                  await requireVerifiedAction(async () => {
                    await activeHook.createClassroom({
                      userId: targetTeacherId ?? "",
                      ...input,
                    });
                  }, "Create classroom");
                }}
                onUpdateClassroom={async (input) => {
                  await requireVerifiedAction(async () => {
                    await activeHook.updateClassroom({
                      teacherId: targetTeacherId ?? "",
                      ...input,
                    });
                    toast({ title: "Classroom updated" });
                  }, "Update classroom");
                }}
                onDeleteClassroom={async (input) => {
                  await requireVerifiedAction(async () => {
                    await activeHook.deleteClassroom({
                      teacherId: targetTeacherId ?? "",
                      ...input,
                    });
                    toast({ title: "Classroom deleted" });
                  }, "Delete classroom");
                }}
                onCreateAssignment={async (input) => {
                  return await requireVerifiedAction(async () => {
                    const created = await activeHook.createAssignment({
                      teacherId: targetTeacherId ?? "",
                      ...input,
                    });
                    toast({ title: "Assignment created" });
                    return created;
                  }, "Create assignment");
                }}
                onMotivateStudents={async (input) => {
                  await requireVerifiedAction(async () => {
                    await activeHook.motivateStudents({
                      teacherId: targetTeacherId ?? "",
                      ...input,
                    });
                    toast({ title: "Motivation sent" });
                  }, "Motivate students");
                }}
                onRewardTopStudents={async (input) => {
                  await requireVerifiedAction(async () => {
                    await activeHook.rewardTopStudents({
                      teacherId: targetTeacherId ?? "",
                      ...input,
                    });
                    toast({ title: "Top students rewarded" });
                  }, "Reward top students");
                }}
                onScheduleLiveSession={async (input) => {
                  await requireVerifiedAction(async () => {
                    await activeHook.createSession({
                      teacherId: targetTeacherId ?? "",
                      ...input,
                    });
                    toast({ title: "Lesson scheduled" });
                  }, "Create session");
                }}
              />
            ) : null}
            {activeSection === "myClasses" ? (
              <MyClassesView
                sessions={activeHook.data.sessions}
                classrooms={activeHook.data.classrooms}
                onScheduleClass={async (input) => {
                  await requireVerifiedAction(async () => {
                    await activeHook.createSession({
                      teacherId: targetTeacherId ?? "",
                      ...input,
                    });
                    toast({ title: "Lesson scheduled" });
                  }, "Create session");
                }}
              />
            ) : null}
            {activeSection === "gyanWall" ? (
              <GyanWallView
                summary={activeHook.data.summary}
                wallItems={activeHook.data.wallItems}
                teacherId={targetTeacherId ?? ""}
                onPostTeacherSection={async (input) => {
                  await requireVerifiedAction(async () => {
                    await activeHook.submitTeacherSection(input);
                  }, "Post teacher section");
                }}
              />
            ) : null}
            {activeSection === "createTests" ? (
              <CreateTestsView
                onNavigateToSection={handleSectionChange}
                teacherId={targetTeacherId ?? ""}
                classrooms={activeHook.data.classrooms}
                onRequireVerifiedAction={async (actionLabel) => {
                  const result = await guardAction(async () => true, { actionLabel });
                  return result === true;
                }}
                onCreateAssignment={async (input) => {
                  return await requireVerifiedAction(async () => {
                    const created = await activeHook.createAssignment(input);
                    toast({ title: "Assignment created" });
                    return created;
                  }, "Create assignment");
                }}
              />
            ) : null}
            {activeSection === "referEarn" ? (
              <ReferEarnView
                referStats={activeHook.data.referStats}
                onCopyLink={() => {
                  void navigator.clipboard.writeText(activeHook.data!.referStats.referralLink);
                  toast({ title: "Referral link copied" });
                }}
              />
            ) : null}
            {activeSection === "profile" ? (
              <TeacherProfileView
                profile={activeHook.data.profile}
                autoStartEditing={autoEditProfile}
                onSave={async (input) => {
                  await activeHook.saveProfile(input);
                }}
                allowAvatarUpload={!isAdminImpersonation}
                onAvatarUpdated={() => activeHook.refresh({ silent: true })}
              />
            ) : null}
          </>
        ) : null}
      </TeacherPortalShell>
      {isGateOpen ? (
        <TeacherVerificationGate
          status={verificationStatus}
          adminNotes={activeHook.data?.profile.details.adminNotes ?? null}
          actionLabel={blockedActionLabel}
          mode="modal"
          onGoToProfile={handleOpenVerificationProfile}
          onRefresh={handleRefreshVerificationStatus}
          onClose={closeGate}
        />
      ) : null}
    </ProtectedRoute>
  );
}

export default function TeacherPortalPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[40vh] flex items-center justify-center text-sm text-muted-foreground">
          Loading teacher portal...
        </div>
      }
    >
      <TeacherRdmCostsProvider>
        <TeacherPortalPageContent />
      </TeacherRdmCostsProvider>
    </Suspense>
  );
}
