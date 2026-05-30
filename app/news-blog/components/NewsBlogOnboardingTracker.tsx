"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  isNewsBlogCompanionTrackingActive,
  markNewsBlogCompanionListOpened,
  reconcileNewsBlogCompanionSteps,
} from "@/lib/onboarding/newsBlogCompanionOnboarding";

/** Marks checklist step 1 when the hub route is open during the news_blog companion flow. */
export function NewsBlogOnboardingTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!isNewsBlogCompanionTrackingActive()) return;
    reconcileNewsBlogCompanionSteps();
    if (pathname === "/news-blog") {
      markNewsBlogCompanionListOpened();
    }
  }, [pathname]);

  return null;
}
