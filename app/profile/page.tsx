"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import StudentProfilePersonalHub from "@/components/profile/StudentProfilePersonalHub";

export default function Profile() {
  const router = useRouter();
  const { user: authUser, profile, loading: authLoading, refreshProfile } = useAuth();

  useEffect(() => {
    if (authLoading) return;
    if (!authUser) return;
    void refreshProfile();
  }, [authLoading, authUser, refreshProfile]);

  useEffect(() => {
    if (authLoading) return;
    if (profile?.role !== "teacher") return;
    router.replace("/teacher-portal?section=profile");
  }, [authLoading, profile?.role, router]);

  if (authLoading || (authUser && !profile)) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen flex items-center justify-center">
          <span className="text-4xl animate-pulse">🎯</span>
        </div>
      </ProtectedRoute>
    );
  }

  if (profile?.role === "teacher") {
    return (
      <ProtectedRoute>
        <div className="min-h-screen flex items-center justify-center">
          <span className="text-4xl animate-pulse">🎯</span>
        </div>
      </ProtectedRoute>
    );
  }

  if (!profile || !authUser) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen flex items-center justify-center">
          <span className="text-4xl animate-pulse">🎯</span>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <AppLayout wideMain>
        <div className="mx-auto w-full min-w-0 max-w-[1920px]">
          <StudentProfilePersonalHub
            profile={profile}
            authUser={authUser}
            onProfileUpdated={refreshProfile}
          />
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
