"use client";

import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

type AppRole = "student" | "teacher" | "admin";

export function ProtectedRoute({
  children,
  allowRoles,
  redirectTo,
}: {
  children: ReactNode;
  allowRoles?: readonly AppRole[];
  redirectTo?: string;
}) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/");
      return;
    }
    if (profile !== null && !profile?.onboarding_complete) {
      const role = profile?.role === "teacher" ? "teacher" : "student";
      router.replace(`/onboarding?role=${role}`);
      return;
    }
    if (
      profile !== null &&
      Array.isArray(allowRoles) &&
      allowRoles.length > 0 &&
      !allowRoles.includes(profile.role)
    ) {
      router.replace(redirectTo ?? (profile.role === "teacher" ? "/teacher-portal" : "/home"));
    }
  }, [user, profile, profile?.onboarding_complete, loading, allowRoles, redirectTo, router]);

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="text-4xl animate-pulse">🎯</span>
      </div>
    );
  if (!user) return null;
  if (profile === null)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="text-4xl animate-pulse">🎯</span>
      </div>
    );
  if (!profile?.onboarding_complete) return null;
  if (
    Array.isArray(allowRoles) &&
    allowRoles.length > 0 &&
    !allowRoles.includes(profile.role)
  )
    return null;
  return <>{children}</>;
}
