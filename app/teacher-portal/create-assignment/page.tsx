"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import TeacherPortalShell from "@/components/teacher-portal/shell/TeacherPortalShell";
import { useAuth } from "@/hooks/useAuth";
import { useTeacherPortalData } from "@/hooks/useTeacherPortalData";
import { useToast } from "@/hooks/use-toast";
import CreateAssignmentWizard from "@/components/teacher-portal/assignment/CreateAssignmentWizard";
import { useTeacherVerificationActionGuard } from "@/hooks/useTeacherVerificationActionGuard";
import { TEACHER_VERIFICATION_REQUIRED_ERROR } from "@/lib/teacherPortal/queries";

function CreateAssignmentPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { user, profile, loading: authLoading } = useAuth();
  const normalizedRole = (profile?.role ?? "").toLowerCase().trim();
  const isTeacherRole = normalizedRole === "teacher";
  const isAdminRole = normalizedRole === "admin";

  useEffect(() => {
    if (!user || authLoading) return;
    if (isTeacherRole) return;
    if (isAdminRole) {
      router.replace("/admin/teacher-portal");
      return;
    }
    router.replace("/home");
  }, [user, authLoading, isTeacherRole, isAdminRole, router]);
  const { data, loading, error, createAssignment } = useTeacherPortalData(user?.id);
  const verificationStatus = data?.profile.details.verificationStatus ?? "unverified";
  const { guardAction } = useTeacherVerificationActionGuard({
    verificationStatus,
    isAdminImpersonation: false,
  });
  const classroomIdPrefill = (searchParams.get("classroomId") ?? "").trim() || null;

  if (!user) {
    return (
      <ProtectedRoute>
        <div />
      </ProtectedRoute>
    );
  }

  if (authLoading || !isTeacherRole) {
    return (
      <ProtectedRoute>
        <div className="flex min-h-screen items-center justify-center bg-[#07070f] text-slate-200">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" aria-hidden />
        </div>
      </ProtectedRoute>
    );
  }

  const teacherName = data?.profile.name ?? profile?.name ?? "Teacher";
  const teacherSubtitle = data?.profile?.subjects.join(" · ") || "EduBlast Teacher";
  const rdmBalance = data?.profile.rdm ?? profile?.rdm ?? 0;

  return (
    <ProtectedRoute>
      <TeacherPortalShell
        activeSection="myClassroom"
        onSectionChange={() => router.push("/teacher-portal?section=myClassroom")}
        rdmBalance={rdmBalance}
        teacherName={teacherName}
        teacherSubtitle={teacherSubtitle}
        onOpenCreateTests={() => router.push("/teacher-portal?section=createTests")}
      >
        {loading && !data ? (
          <div className="flex min-h-[55vh] items-center justify-center gap-2 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading…
          </div>
        ) : error ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
            {error}
          </div>
        ) : data ? (
          <div className="px-3 pb-10 pt-4 sm:px-6">
            <CreateAssignmentWizard
              teacherId={user.id}
              classrooms={data.classrooms}
              classroomDetails={data.classroomDetails}
              initialClassroomId={classroomIdPrefill}
              onCancel={() => router.push("/teacher-portal?section=myClassroom")}
              onPublish={async (input) => {
                const allowed = await guardAction(
                  async () => {
                    await createAssignment({ teacherId: user.id, ...input });
                    return true;
                  },
                  { actionLabel: "Create assignment" }
                );
                if (allowed !== true) {
                  throw new Error(TEACHER_VERIFICATION_REQUIRED_ERROR);
                }
                toast({ title: "Assignment created" });
                router.push("/teacher-portal?section=myClassroom");
              }}
            />
          </div>
        ) : null}
      </TeacherPortalShell>
    </ProtectedRoute>
  );
}

export default function CreateAssignmentPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
          Loading…
        </div>
      }
    >
      <CreateAssignmentPageContent />
    </Suspense>
  );
}
