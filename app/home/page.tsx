"use client";

import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useStreakTimer } from "@/hooks/useStreakTimer";
import TeacherDashboard from "@/components/TeacherDashboard";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import StudentHomeDashboard from "@/components/dashboard/StudentHomeDashboard";

export default function HomePage() {
  const { profile, refreshProfile } = useAuth();
  const streakTimer = useStreakTimer();

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  if (profile?.role === "teacher") {
    return (
      <ProtectedRoute>
        <TeacherDashboard />
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
