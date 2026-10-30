"use client";

import dynamic from "next/dynamic";

const ExplorePage = dynamic(() => import("./ExploreClient"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[50vh] items-center justify-center">
      <p className="font-medium text-muted-foreground">Loading...</p>
    </div>
  ),
});

/** Skip server render of the syllabus browser. That render is large enough to time out and return HTTP 500. */
export function LearnHubLoader() {
  return <ExplorePage />;
}
