"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useStreakTimer } from "@/hooks/useStreakTimer";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import StudentHomeDashboard from "@/components/dashboard/StudentHomeDashboard";

export default function HomePage() {
  const { profile, refreshProfile } = useAuth();
  const router = useRouter();
  const streakTimer = useStreakTimer();

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  useEffect(() => {
    if (profile?.role === "teacher") {
      router.replace("/teacher-portal");
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
      <DashboardLayout streakTimer={streakTimer}>
        <StudentHomeDashboard />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
