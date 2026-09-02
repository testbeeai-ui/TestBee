"use client";

import { Suspense } from "react";

import AppLayout from "@/components/AppLayout";
import { EduDecaMockExperience } from "@/components/edudeca-mock/EduDecaMockExperience";

export default function EduDecaMockPage() {
  return (
    <AppLayout>
      <Suspense fallback={<div className="min-h-[40vh]" />}>
        <EduDecaMockExperience />
      </Suspense>
    </AppLayout>
  );
}
