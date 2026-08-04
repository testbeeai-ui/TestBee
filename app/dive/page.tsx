"use client";

import { Suspense } from "react";
import AppLayout from "@/components/AppLayout";
import DiveWizard from "@/components/dive/DiveWizard";

function DivePageContent() {
  return (
    <AppLayout>
      <DiveWizard />
    </AppLayout>
  );
}

export default function DivePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
          Loading Dive…
        </div>
      }
    >
      <DivePageContent />
    </Suspense>
  );
}
