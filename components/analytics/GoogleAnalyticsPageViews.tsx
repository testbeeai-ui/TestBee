"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { GA_MEASUREMENT_ID } from "@/lib/analytics/ga";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Sends GA4 page_view on App Router client navigations.
 * Initial hard load is covered by gtag('config') in GoogleAnalytics scripts.
 * Must sit inside Suspense (useSearchParams).
 */
export function GoogleAnalyticsPageViews() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const isFirstLoad = useRef(true);

  useEffect(() => {
    if (!pathname || !GA_MEASUREMENT_ID) return;

    // First paint: root gtag config already recorded the landing pageview.
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      return;
    }

    const pagePath = queryString ? `${pathname}?${queryString}` : pathname;

    const send = (): boolean => {
      if (typeof window.gtag !== "function") return false;
      window.gtag("config", GA_MEASUREMENT_ID, { page_path: pagePath });
      return true;
    };

    if (send()) return;

    const intervalId = window.setInterval(() => {
      if (send()) window.clearInterval(intervalId);
    }, 100);
    const timeoutId = window.setTimeout(() => window.clearInterval(intervalId), 5_000);

    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    };
  }, [pathname, queryString]);

  return null;
}
