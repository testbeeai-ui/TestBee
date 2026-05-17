"use client";

export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { MockPageContent } from "@/components/prep-mock/MockPageContent";

export default function MockTestPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
          <span className="sr-only">Loading mock test library…</span>
        </div>
      }
    >
      <MockPageContent pageMode="library" />
    </Suspense>
  );
}
