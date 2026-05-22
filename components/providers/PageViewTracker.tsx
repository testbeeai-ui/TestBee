"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { trackPageView } from "@/lib/analytics/track";

/**
 * Tracks page_view events on every route change.
 * Must be inside Suspense boundary (useSearchParams).
 */
export function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (pathname) {
      trackPageView(pathname);
    }
  }, [pathname, searchParams]);

  return null;
}
