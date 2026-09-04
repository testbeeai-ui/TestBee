import { Suspense } from "react";

import AppLayout from "@/components/AppLayout";
import { EduDecaMockExperience } from "@/components/edudeca-mock/EduDecaMockExperience";

export const dynamic = "force-dynamic";

export default function EduDecaMockPage() {
  return (
    <Suspense fallback={<div className="min-h-[40vh]" />}>
      <AppLayout>
        <EduDecaMockExperience />
      </AppLayout>
    </Suspense>
  );
}
