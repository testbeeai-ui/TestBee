"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/hooks/useAuth";
import { useTeacherPortalData } from "@/hooks/useTeacherPortalData";
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
  } = useTeacherPortalData(user?.id);
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

  if (profile?.role !== "teacher") {
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

  const teacherName = data?.profile.name ?? profile.name ?? "Teacher";
  const teacherSubtitle = data?.profile.subjects.join(" · ") || "EduBlast Teacher";
  const rdmBalance = data?.profile.rdm ?? profile.rdm ?? 0;

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
        {loading && !data ? (
          <div className="flex min-h-[50vh] items-center justify-center gap-2 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading teacher portal...
          </div>
        ) : error ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
            {error}
          </div>
        ) : data ? (
          <>
            {activeSection === "myClassroom" ? (
              <MyClassroomView
                summary={data.summary}
                classrooms={data.classrooms}
                classroomDetails={data.classroomDetails}
                teacherId={user.id}
                onRefreshTeacherPortal={refresh}
                onCreateClassroom={async (input) => {
                  await createClassroom({
                    userId: user.id,
                    ...input,
                  });
                }}
                onUpdateClassroom={async (input) => {
                  await updateClassroom({
                    teacherId: user.id,
                    ...input,
                  });
                  toast({ title: "Classroom updated" });
                }}
                onDeleteClassroom={async (input) => {
                  await deleteClassroom({
                    teacherId: user.id,
                    ...input,
                  });
                  toast({ title: "Classroom deleted" });
                }}
                onCreateAssignment={async (input) => {
                  await createAssignment({
                    teacherId: user.id,
                    ...input,
                  });
                  toast({ title: "Assignment created" });
                }}
                onMotivateStudents={async (input) => {
                  await motivateStudents({
                    teacherId: user.id,
                    ...input,
                  });
                  toast({ title: "Motivation sent" });
                }}
                onRewardTopStudents={async (input) => {
                  await rewardTopStudents({
                    teacherId: user.id,
                    ...input,
                  });
                  toast({ title: "Top students rewarded" });
                }}
              />
            ) : null}
            {activeSection === "myClasses" ? (
              <MyClassesView
                sessions={data.sessions}
                classrooms={data.classrooms}
                onScheduleClass={async (input) => {
                  await createSession({
                    teacherId: user.id,
                    ...input,
                  });
                  toast({ title: "Class scheduled" });
                }}
              />
            ) : null}
            {activeSection === "gyanWall" ? (
              <GyanWallView
                summary={data.summary}
                wallItems={data.wallItems}
                teacherId={user.id}
                onPostTeacherSection={submitTeacherSection}
              />
            ) : null}
            {activeSection === "createTests" ? (
              <CreateTestsView
                onNavigateToSection={handleSectionChange}
                teacherId={user.id}
                classrooms={data.classrooms}
                onCreateAssignment={async (input) => {
                  await createAssignment(input);
                  toast({ title: "Assignment created" });
                }}
              />
            ) : null}
            {activeSection === "referEarn" ? (
              <ReferEarnView
                referStats={data.referStats}
                onCopyLink={() => {
                  void navigator.clipboard.writeText(data.referStats.referralLink);
                  toast({ title: "Referral link copied" });
                }}
              />
            ) : null}
            {activeSection === "profile" ? (
              <TeacherProfileView profile={data.profile} onSave={saveProfile} />
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
