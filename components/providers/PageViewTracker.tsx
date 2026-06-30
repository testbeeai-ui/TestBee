"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { trackPageView } from "@/lib/analytics/track";
import { useAuth } from "@/hooks/useAuth";

/**
 * Tracks page_view events on every route change (signed-in students only).
 * Must be inside Suspense boundary (useSearchParams).
 */
export function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const { user, profile, loading } = useAuth();

  useEffect(() => {
    if (loading || !user || !profile?.id || !pathname) return;
    const path = queryString ? `${pathname}?${queryString}` : pathname;
    trackPageView(path);
  }, [loading, user, profile?.id, pathname, queryString]);

  return null;
}
