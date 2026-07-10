"use client";

import { useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useStreakTimer } from "@/hooks/useStreakTimer";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import StudentHomeDashboard from "@/components/dashboard/StudentHomeDashboard";
import RedesignedHomeDashboard from "@/components/dashboard/RedesignedHomeDashboard";
import { TEACHER_PORTAL_CLASSROOMS_URL } from "@/lib/teacherPortal/routes";

function HomeContent() {
  const { profile, refreshProfile } = useAuth();
  const router = useRouter();
  const streakTimer = useStreakTimer();
  const searchParams = useSearchParams();
  const page = searchParams.get("page");

  // page=dashboard → actual student dashboard with sidebar
  // anything else (no param, page=home, page=info/prep/fun/earn) → RedesignedHomeDashboard
  const isStudentDashboard = page === "dashboard";

  const profileHydratedRef = useRef(false);
  useEffect(() => {
    if (profileHydratedRef.current) return;
    profileHydratedRef.current = true;
    void refreshProfile();
  }, [refreshProfile]);

  useEffect(() => {
    if (profile?.role === "teacher") {
      router.replace(TEACHER_PORTAL_CLASSROOMS_URL);
    }
  }, [profile?.role, router]);

  if (profile?.role === "teacher") {
    return (
      <ProtectedRoute>
        <div className="min-h-[40vh] flex items-center justify-center text-muted-foreground">
          Redirecting to Teacher Portal...
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <DashboardLayout streakTimer={streakTimer} hideSidebar={!isStudentDashboard}>
        {isStudentDashboard ? <StudentHomeDashboard /> : <RedesignedHomeDashboard />}
      </DashboardLayout>
    </ProtectedRoute>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0A0F1E] flex items-center justify-center text-muted-foreground">
        Loading...
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
