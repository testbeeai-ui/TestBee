"use client";

import { useEffect, useRef } from "react";
import { ONBOARDING_ACTIVE_TASK_CHANGED_EVENT } from "@/lib/onboarding/onboardingTaskCompanion";
import {
  isNewsBlogCompanionTrackingActive,
  markNewsBlogCompanionArticleOpened,
  markNewsBlogCompanionArticleRead,
  markNewsBlogCompanionFlowComplete,
  reconcileNewsBlogCompanionSteps,
} from "@/lib/onboarding/newsBlogCompanionOnboarding";

const READ_SCROLL_THRESHOLD_PX = 120;

/** Tracks article open + scroll-to-read for the news_blog task companion. */
export function ArticleOnboardingTracker() {
  const readMarkedRef = useRef(false);

  useEffect(() => {
    if (!isNewsBlogCompanionTrackingActive()) return;
    reconcileNewsBlogCompanionSteps();
    markNewsBlogCompanionArticleOpened();
    window.dispatchEvent(
      new CustomEvent(ONBOARDING_ACTIVE_TASK_CHANGED_EVENT, { detail: "news_blog" })
    );
    readMarkedRef.current = false;

    const checkReadProgress = () => {
      if (readMarkedRef.current) return;
      const scrollY = window.scrollY;
      const viewportHeight = window.innerHeight;
      const totalHeight = document.documentElement.scrollHeight;
      const fitsInViewport = totalHeight <= viewportHeight + READ_SCROLL_THRESHOLD_PX;
      const scrolledToEnd =
        fitsInViewport || scrollY + viewportHeight >= totalHeight - READ_SCROLL_THRESHOLD_PX;
      if (scrolledToEnd) {
        readMarkedRef.current = true;
        markNewsBlogCompanionArticleRead();
        markNewsBlogCompanionFlowComplete();
      }
    };

    const onScroll = () => checkReadProgress();
    window.addEventListener("scroll", onScroll, { passive: true });
    const timerId = window.setTimeout(checkReadProgress, 800);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(timerId);
    };
  }, []);

  return null;
}
