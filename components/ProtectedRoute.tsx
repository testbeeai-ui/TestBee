"use client";

import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/auth");
      return;
    }
    if (profile !== null && !profile?.onboarding_complete) {
      router.replace("/onboarding");
      return;
    }
  }, [user, profile, profile?.onboarding_complete, loading, router]);

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="text-4xl animate-pulse">🎯</span>
      </div>
    );
  if (!user) return null;
  if (profile === null) return (
    <div className="min-h-screen flex items-center justify-center">
      <span className="text-4xl animate-pulse">🎯</span>
    </div>
  );
  if (!profile?.onboarding_complete) return null;
  return <>{children}</>;
}
