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
  const queryString = searchParams.toString();

  useEffect(() => {
    if (!pathname) return;
    const path = queryString ? `${pathname}?${queryString}` : pathname;
    trackPageView(path);
  }, [pathname, queryString]);

  return null;
}
