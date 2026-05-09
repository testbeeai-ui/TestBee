"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import AppLayout from "@/components/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/hooks/useAuth";
import StudentSettingsHub from "@/components/profile/StudentSettingsHub";

export default function SettingsPage() {
  const router = useRouter();
  const { user: authUser, profile, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading) return;
    if (!authUser) return;
    if (profile?.role === "teacher") {
      router.replace("/profile");
    }
  }, [authLoading, authUser, profile?.role, router]);

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

  if (!profile) {
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
      <AppLayout>
        <div className="mx-auto w-full max-w-6xl px-0">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-border bg-card/50 p-4 dark:border-white/10 dark:bg-[#070b14]/80 md:p-5 2xl:rounded-3xl 2xl:p-7"
          >
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground dark:text-slate-500 2xl:mb-4">
              Account
            </p>
            <StudentSettingsHub />
          </motion.div>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
