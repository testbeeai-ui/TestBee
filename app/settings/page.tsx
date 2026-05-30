"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/hooks/useAuth";

/**
 * Students: account UI lives under `/profile` (Settings section). Teachers use the portal profile tab.
 */
export default function SettingsPage() {
  const router = useRouter();
  const { user: authUser, profile, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading || !authUser || !profile) return;
    if (profile.role === "teacher") {
      router.replace("/teacher-portal?section=profile");
      return;
    }
    router.replace("/profile?section=settings");
  }, [authLoading, authUser, profile, router]);

  if (!authLoading && !authUser) {
    return <ProtectedRoute>{null}</ProtectedRoute>;
  }

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen items-center justify-center">
        <span className="text-4xl animate-pulse">🎯</span>
      </div>
    </ProtectedRoute>
  );
}
