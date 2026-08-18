"use client";

import { Suspense } from "react";

import AboutUsClient from "./AboutUsClient";

export default function AboutUsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
          Loading…
        </div>
      }
    >
      <AboutUsClient />
    </Suspense>
  );
}
