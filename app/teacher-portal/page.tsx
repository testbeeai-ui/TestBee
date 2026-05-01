"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/hooks/useAuth";
import { useTeacherPortalData } from "@/hooks/useTeacherPortalData";
import { useAdminTeacherPortalData } from "@/hooks/useAdminTeacherPortalData";
import type { TeacherPortalSection } from "@/lib/teacherPortal/types";
import TeacherPortalShell from "@/components/teacher-portal/TeacherPortalShell";
import MyClassroomView from "@/components/teacher-portal/MyClassroomView";
import MyClassesView from "@/components/teacher-portal/MyClassesView";
import GyanWallView from "@/components/teacher-portal/GyanWallView";
import ReferEarnView from "@/components/teacher-portal/ReferEarnView";
import TeacherProfileView from "@/components/teacher-portal/TeacherProfileView";
import CreateTestsView from "@/components/teacher-portal/CreateTestsView";
import { useToast } from "@/hooks/use-toast";

function TeacherPortalPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const [section, setSection] = useState<TeacherPortalSection>("myClassroom");
  const adminTeacherIdRaw = searchParams.get("adminTeacherId")?.trim() ?? "";
  const isAdminImpersonation = Boolean(adminTeacherIdRaw) && profile?.role === "admin";
  const targetTeacherId = isAdminImpersonation ? adminTeacherIdRaw : user?.id ?? null;

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
  } = useTeacherPortalData(!isAdminImpersonation ? user?.id : null);

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

  const handleSectionChange = (next: TeacherPortalSection) => {
    if (paramSection) {
      router.replace("/teacher-portal");
    }
    setSection(next);
  };

  if (!user) {
    return (
      <ProtectedRoute>
        <div />
      </ProtectedRoute>
    );
  }

  if (!isAdminImpersonation && profile?.role !== "teacher") {
    return (
      <ProtectedRoute>
        <div className="flex min-h-screen items-center justify-center bg-[#07070f] text-slate-200">
          <div className="text-center">
            <h1 className="mb-2 text-xl font-semibold">
              Teacher portal is only for teacher accounts.
            </h1>
            <button
              type="button"
              onClick={() => router.push("/home")}
              className="rounded-full border border-white/20 px-4 py-2 text-sm hover:bg-white/5"
            >
              Go to dashboard
            </button>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  const teacherName =
    activeHook.data?.profile.name ??
    (isAdminImpersonation ? "Teacher" : profile.name ?? "Teacher");
  const teacherSubtitle = activeHook.data?.profile.subjects.join(" · ") || "EduBlast Teacher";
  const rdmBalance = activeHook.data?.profile.rdm ?? (isAdminImpersonation ? 0 : profile.rdm ?? 0);

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
                teacherId={targetTeacherId ?? ""}
                onRefreshTeacherPortal={activeHook.refresh}
                onCreateClassroom={async (input) => {
                  await activeHook.createClassroom({
                    userId: targetTeacherId ?? "",
                    ...input,
                  });
                }}
                onUpdateClassroom={async (input) => {
                  await activeHook.updateClassroom({
                    teacherId: targetTeacherId ?? "",
                    ...input,
                  });
                  toast({ title: "Classroom updated" });
                }}
                onDeleteClassroom={async (input) => {
                  await activeHook.deleteClassroom({
                    teacherId: targetTeacherId ?? "",
                    ...input,
                  });
                  toast({ title: "Classroom deleted" });
                }}
                onCreateAssignment={async (input) => {
                  await activeHook.createAssignment({
                    teacherId: targetTeacherId ?? "",
                    ...input,
                  });
                  toast({ title: "Assignment created" });
                }}
                onMotivateStudents={async (input) => {
                  await activeHook.motivateStudents({
                    teacherId: targetTeacherId ?? "",
                    ...input,
                  });
                  toast({ title: "Motivation sent" });
                }}
                onRewardTopStudents={async (input) => {
                  await activeHook.rewardTopStudents({
                    teacherId: targetTeacherId ?? "",
                    ...input,
                  });
                  toast({ title: "Top students rewarded" });
                }}
                onScheduleLiveSession={async (input) => {
                  await activeHook.createSession({
                    teacherId: targetTeacherId ?? "",
                    ...input,
                  });
                  toast({ title: "Lesson scheduled" });
                }}
              />
            ) : null}
            {activeSection === "myClasses" ? (
              <MyClassesView
                sessions={activeHook.data.sessions}
                classrooms={activeHook.data.classrooms}
                onScheduleClass={async (input) => {
                  await activeHook.createSession({
                    teacherId: targetTeacherId ?? "",
                    ...input,
                  });
                  toast({ title: "Lesson scheduled" });
                }}
              />
            ) : null}
            {activeSection === "gyanWall" ? (
              <GyanWallView
                summary={activeHook.data.summary}
                wallItems={activeHook.data.wallItems}
                teacherId={targetTeacherId ?? ""}
                onPostTeacherSection={activeHook.submitTeacherSection}
              />
            ) : null}
            {activeSection === "createTests" ? (
              <CreateTestsView
                onNavigateToSection={handleSectionChange}
                teacherId={targetTeacherId ?? ""}
                classrooms={activeHook.data.classrooms}
                onCreateAssignment={async (input) => {
                  await activeHook.createAssignment(input);
                  toast({ title: "Assignment created" });
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
              <TeacherProfileView profile={activeHook.data.profile} onSave={activeHook.saveProfile} />
            ) : null}
          </>
        ) : null}
      </TeacherPortalShell>
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
      <TeacherPortalPageContent />
    </Suspense>
  );
}
