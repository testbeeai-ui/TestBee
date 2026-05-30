"use client";

import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { TEACHER_PORTAL_CLASSROOMS_URL } from "@/lib/teacherPortal/routes";

type AppRole = "student" | "teacher" | "admin";

/** Normalize DB / legacy values so gates stay predictable (case, null → student). */
function normalizeAppRole(role: string | null | undefined): AppRole {
  if (role == null || typeof role !== "string") return "student";
  const r = role.toLowerCase().trim();
  if (r === "teacher") return "teacher";
  if (r === "admin") return "admin";
  if (r === "student") return "student";
  return "student";
}

/**
 * Student-only surfaces (`allowRoles: ["student"]`) must still work for admins
 * auditing the product; otherwise every nav item gated that way bounces to /home.
 */
function isRoleAllowed(
  profileRole: string | null | undefined,
  allowRoles: readonly AppRole[] | undefined
) {
  if (!allowRoles || allowRoles.length === 0) return true;
  const normalized = normalizeAppRole(profileRole);
  if (allowRoles.includes(normalized)) return true;
  if (allowRoles.includes("student") && normalized === "admin") return true;
  return false;
}

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
  const allowRolesKey =
    Array.isArray(allowRoles) && allowRoles.length > 0 ? [...allowRoles].sort().join("|") : "";

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/");
      return;
    }
    if (profile !== null && !profile?.onboarding_complete) {
      const role = normalizeAppRole(profile?.role) === "teacher" ? "teacher" : "student";
      router.replace(`/onboarding?role=${role}`);
      return;
    }
    if (profile !== null && !isRoleAllowed(profile.role, allowRoles)) {
      const normalized = normalizeAppRole(profile.role);
      router.replace(
        redirectTo ?? (normalized === "teacher" ? TEACHER_PORTAL_CLASSROOMS_URL : "/home")
      );
    }
  }, [
    user,
    profile,
    profile?.onboarding_complete,
    profile?.role,
    loading,
    allowRolesKey,
    redirectTo,
    router,
  ]);

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
  if (!isRoleAllowed(profile.role, allowRoles)) return null;
  return <>{children}</>;
}
