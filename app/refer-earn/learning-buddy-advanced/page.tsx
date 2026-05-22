"use client";

import AppLayout from "@/components/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { LearningBuddyAdvancedShell } from "@/components/refer-earn/learning-buddy/LearningBuddyAdvancedShell";
export default function LearningBuddyAdvancedPage() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="mx-auto w-full max-w-6xl px-1 pb-10 font-sans sm:px-2">
          <div className="rounded-[18px] bg-gradient-to-br from-violet-500/30 via-fuchsia-500/20 to-cyan-500/25 p-[1.5px] shadow-[0_20px_60px_-20px_rgba(127,119,221,0.35)]">
            <LearningBuddyAdvancedShell />
          </div>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
