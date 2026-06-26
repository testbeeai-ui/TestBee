"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import {
  Wand2,
  BookOpen,
  GraduationCap,
  MessageSquare,
  Users,
  Sparkles,
  Newspaper,
  Coins,
  User,
  Check,
  ChevronRight,
  ChevronLeft,
  X,
  GripVertical,
  Trophy,
  Clock,
} from "lucide-react";
import {
  formatGyanBrowseCountdown,
  getGyanPlusBrowseCountdownSnapshot,
  GYAN_BROWSE_TIMER_EVENT,
  reconcileGyanPlusCompanionSteps,
  type GyanBrowseTimerSnapshot,
} from "@/lib/onboarding/gyanPlusCompanionOnboarding";
import { markPrepClassesStep0FromClassroomsPage } from "@/lib/onboarding/prepClassesCompanionOnboarding";
import {
  markNewsBlogCompanionArticleOpened,
  markNewsBlogCompanionListOpened,
  reconcileNewsBlogCompanionSteps,
} from "@/lib/onboarding/newsBlogCompanionOnboarding";
import { ONBOARDING_REWARD_TASKS } from "@/components/dashboard/OnboardingRewardDialog";
import {
  PLAY_DAILYDOSE_COMPANION_TASK,
  TASK_ID as PLAY_DAILYDOSE_TASK_ID,
  markPlayDailyDoseCompanionOnPlayPage,
  markPlayDailyDoseCompanionStarted,
} from "@/lib/onboarding/playDailyDoseCompanionOnboarding";
import {
  clampCompanionPosition,
  clearCompanionExpandedPreference,
  dismissOnboardingTaskCompanion,
  getCenterLauncherPosition,
  getDefaultLauncherPosition,
  getDefaultPanelPosition,
  isOnboardingTaskCompanionLaunched,
  loadCompanionExpandedPreference,
  loadCompanionPosition,
  loadPanelPosition,
  savePanelPosition,
  ONBOARDING_ACTIVE_TASK_CHANGED_EVENT,
  ONBOARDING_COMPANION_PENDING_EXPAND_KEY,
  saveCompanionExpandedPreference,
  saveCompanionPosition,
  dispatchOnboardingTaskCelebrationEnded,
} from "@/lib/onboarding/onboardingTaskCompanion";
import { isPathRelevantForOnboardingTask } from "@/lib/onboarding/onboardingTaskCompanionRoutes";
import { isDailyCbseMcqChecklistTrackingActive } from "@/lib/onboarding/dailyCbseMcqChecklist";
import {
  isDailyLessonsChecklistTrackingActive,
  LESSONS_DAILY_COMPANION_TASK,
  reconcileDailyLessonsCompanionSteps,
  DAILY_LESSONS_CHECKLIST_COMPLETE_EVENT,
  DAILY_LESSONS_PROGRESS_PANEL_EVENT,
} from "@/lib/onboarding/dailyLessonsChecklist";
import { isDailyChecklistCompanionRetryActive } from "@/lib/onboarding/dailyChecklistCompanionRetry";
import { LESSONS_SUBJECT_SELECTED_EVENT } from "@/lib/onboarding/lessonsOnboarding";
import {
  EARN_BUDDY_COMPANION_PROGRESS_EVENT,
  markEarnBuddyCompanionLinkCopied,
  markEarnBuddyCompanionLinkShared,
} from "@/lib/onboarding/earnBuddyCompanionOnboarding";
import {
  markOnboardingTaskComplete,
  markOnboardingStepComplete,
  getOnboardingProgress,
  isAdminManualOnboardingChecklist,
  isOnboardingTaskComplete,
  ONBOARDING_PROGRESS_EVENT,
  type OnboardingProgressEventDetail,
} from "@/lib/subscription/freeTrialClient";

interface SparkleItem {
  id: number;
  x: number;
  y: number;
  color: string;
  emoji?: string;
  delay: number;
  size: number;
}

function stepsProgressEqual(a: boolean[], b: boolean[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

export function FloatingTaskCompanion() {
  const pathname = usePathname();
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(true);
  const [launcherPos, setLauncherPos] = useState({ x: 0, y: 0 });
  const [panelPos, setPanelPos] = useState({ x: 0, y: 0 });
  const [launcherDocking, setLauncherDocking] = useState(false);
  const [stepsProgress, setStepsProgress] = useState<boolean[]>([]);
  const [celebrating, setCelebrating] = useState(false);
  const [sparkles, setSparkles] = useState<SparkleItem[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const [gyanBrowseTimer, setGyanBrowseTimer] = useState<GyanBrowseTimerSnapshot | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({
    isDragging: false,
    surface: "panel" as "launcher" | "panel",
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
  });
  const timersRef = useRef<{ [key: string]: NodeJS.Timeout }>({});

  const dailyLessonsActive = activeTaskId === "lessons" && isDailyLessonsChecklistTrackingActive();

  const activeTask =
    activeTaskId === PLAY_DAILYDOSE_TASK_ID
      ? PLAY_DAILYDOSE_COMPANION_TASK
      : dailyLessonsActive
        ? LESSONS_DAILY_COMPANION_TASK
        : (ONBOARDING_REWARD_TASKS.find((t) => t.id === activeTaskId) ?? null);
  const stepCount = activeTask?.steps.length ?? 0;

  // Retrieve active task & position on mount
  useEffect(() => {
    setIsMounted(true);
    if (typeof window === "undefined") return;

    // Load active task
    if (isOnboardingTaskCompanionLaunched()) {
      const savedTask = window.localStorage.getItem("edublast_active_onboarding_task");
      if (savedTask) {
        const progress = getOnboardingProgress();
        const done = isOnboardingTaskComplete(savedTask, progress);
        const dailyRetry =
          isDailyChecklistCompanionRetryActive(savedTask) ||
          (savedTask === "lessons" && isDailyLessonsChecklistTrackingActive());
        if (!done || dailyRetry) {
          setActiveTaskId(savedTask);
        }
      }
    }

    const taskForPrefs = window.localStorage.getItem("edublast_active_onboarding_task");
    if (taskForPrefs) {
      const savedLauncher = loadCompanionPosition(taskForPrefs);
      setLauncherPos(savedLauncher ?? getDefaultLauncherPosition());
      const savedPanel = loadPanelPosition(taskForPrefs);
      setPanelPos(savedPanel ?? getDefaultPanelPosition());
      const savedExpanded = loadCompanionExpandedPreference(taskForPrefs);
      if (savedExpanded != null) {
        setIsMinimized(!savedExpanded);
      }
    }
  }, []);

  /** Per-task position + expanded state when switching checklist tasks. */
  useEffect(() => {
    if (!activeTaskId) return;
    const savedLauncher = loadCompanionPosition(activeTaskId);
    setLauncherPos(savedLauncher ?? getDefaultLauncherPosition());
    const savedPanel = loadPanelPosition(activeTaskId);
    setPanelPos(savedPanel ?? getDefaultPanelPosition());
    const savedExpanded = loadCompanionExpandedPreference(activeTaskId);
    if (savedExpanded != null) {
      setIsMinimized(!savedExpanded);
    }
  }, [activeTaskId]);

  // Listen to active task launching
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleActiveTaskChanged = (e: Event) => {
      const taskId = (e as CustomEvent<string>).detail;
      if (taskId) {
        setActiveTaskId(taskId);
        setPanelPos(loadPanelPosition(taskId) ?? getDefaultPanelPosition());
        setIsMinimized(false);
        saveCompanionExpandedPreference(taskId, true);
      } else {
        const prev = activeTaskId;
        if (prev) clearCompanionExpandedPreference(prev);
        setActiveTaskId(null);
      }
    };

    window.addEventListener(ONBOARDING_ACTIVE_TASK_CHANGED_EVENT, handleActiveTaskChanged);
    return () => {
      window.removeEventListener(ONBOARDING_ACTIVE_TASK_CHANGED_EVENT, handleActiveTaskChanged);
    };
  }, []);

  /** Landed on a page where the companion is visible — open the panel once per launch (user can minimize after). */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!activeTaskId || !activeTask) return;
    if (!isOnboardingTaskCompanionLaunched(activeTaskId)) return;
    if (!isPathRelevantForOnboardingTask(activeTaskId, pathname)) return;

    try {
      const pending = window.sessionStorage.getItem(ONBOARDING_COMPANION_PENDING_EXPAND_KEY);
      if (pending === activeTaskId) {
        const savedPanel = loadPanelPosition(activeTaskId);
        setPanelPos(savedPanel ?? getDefaultPanelPosition());
        setIsMinimized(false);
        saveCompanionExpandedPreference(activeTaskId, true);
        window.sessionStorage.removeItem(ONBOARDING_COMPANION_PENDING_EXPAND_KEY);
      }
    } catch {
      /* ignore */
    }
  }, [activeTaskId, activeTask, pathname]);

  const minimizeCompanionPanel = useCallback(() => {
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.removeItem(ONBOARDING_COMPANION_PENDING_EXPAND_KEY);
      } catch {
        /* ignore */
      }
    }
    if (activeTaskId) {
      saveCompanionExpandedPreference(activeTaskId, false);
    }
    const dock = getDefaultLauncherPosition();
    setLauncherPos(
      clampCompanionPosition(
        {
          x: panelPos.x + (containerRef.current?.offsetWidth ?? 310) / 2 - 24,
          y: panelPos.y + (containerRef.current?.offsetHeight ?? 280) / 2 - 24,
        },
        { minimized: true }
      )
    );
    setLauncherDocking(true);
    setIsMinimized(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setLauncherPos(dock);
        if (activeTaskId) saveCompanionPosition(activeTaskId, dock);
        window.setTimeout(() => setLauncherDocking(false), 480);
      });
    });
  }, [activeTaskId, panelPos]);

  const expandCompanionPanel = useCallback(() => {
    if (activeTaskId) {
      const savedPanel = loadPanelPosition(activeTaskId);
      setPanelPos(savedPanel ?? getDefaultPanelPosition());
      saveCompanionExpandedPreference(activeTaskId, true);
    }
    setIsMinimized(false);
  }, [activeTaskId]);

  // Sync steps progress when activeTaskId or DB progress updates
  const syncStepsFromDb = useCallback(() => {
    if (!activeTaskId) return;

    if (activeTaskId === "lessons" && isDailyLessonsChecklistTrackingActive()) {
      const next = reconcileDailyLessonsCompanionSteps(pathname);
      setStepsProgress((prev) => (stepsProgressEqual(prev, next) ? prev : next));
      return;
    }

    const progress = getOnboardingProgress();

    const task =
      ONBOARDING_REWARD_TASKS.find((t) => t.id === activeTaskId) ??
      (activeTaskId === PLAY_DAILYDOSE_TASK_ID ? PLAY_DAILYDOSE_COMPANION_TASK : null);
    const count = task?.steps.length ?? 0;
    if (count === 0) {
      setStepsProgress((prev) => (prev.length === 0 ? prev : []));
      return;
    }

    // Failsafe: if task itself is marked completed, mark all steps completed!
    const dailyRetry =
      isDailyChecklistCompanionRetryActive(activeTaskId) ||
      (activeTaskId === "lessons" && isDailyLessonsChecklistTrackingActive());
    if (isOnboardingTaskComplete(activeTaskId, progress) && !dailyRetry) {
      const allDone = Array.from({ length: count }, () => true);
      setStepsProgress((prev) => (stepsProgressEqual(prev, allDone) ? prev : allDone));
      return;
    }

    // Otherwise, load specific step completions
    const currentSteps = Array.from({ length: count }, (_, idx) =>
      Boolean(progress[`${activeTaskId}_step_${idx}`])
    );
    setStepsProgress((prev) => (stepsProgressEqual(prev, currentSteps) ? prev : currentSteps));
  }, [activeTaskId, pathname]);

  useEffect(() => {
    syncStepsFromDb();
  }, [activeTaskId, syncStepsFromDb]);

  useEffect(() => {
    if (activeTaskId !== "gyan_plus") {
      setGyanBrowseTimer(null);
      return;
    }
    const applySnapshot = (snapshot?: GyanBrowseTimerSnapshot) => {
      setGyanBrowseTimer(snapshot ?? getGyanPlusBrowseCountdownSnapshot());
    };
    const onTick = (event: Event) => {
      applySnapshot((event as CustomEvent<GyanBrowseTimerSnapshot>).detail);
    };
    applySnapshot();
    const onProgress = () => applySnapshot();
    window.addEventListener(GYAN_BROWSE_TIMER_EVENT, onTick);
    window.addEventListener(ONBOARDING_PROGRESS_EVENT, onProgress);
    const pollId = window.setInterval(() => applySnapshot(), 1000);
    return () => {
      window.removeEventListener(GYAN_BROWSE_TIMER_EVENT, onTick);
      window.removeEventListener(ONBOARDING_PROGRESS_EVENT, onProgress);
      window.clearInterval(pollId);
    };
  }, [activeTaskId]);

  const triggerCelebration = useCallback(() => {
    const completedTaskId = activeTaskId;
    setCelebrating(true);
    const colors = ["#8b5cf6", "#10b981", "#3b82f6", "#f59e0b", "#ec4899", "#f43f5e"];
    const emojis = ["✨", "🎉", "🔥", "🚀", "💎", "⭐", "🎯"];
    const newSparkles: SparkleItem[] = Array.from({ length: 30 }).map((_, i) => ({
      id: Date.now() + i,
      x: (Math.random() - 0.5) * 160 + 120,
      y: Math.random() * 50 - 20,
      color: colors[Math.floor(Math.random() * colors.length)],
      emoji: Math.random() > 0.6 ? emojis[Math.floor(Math.random() * emojis.length)] : undefined,
      delay: Math.random() * 0.4,
      size: Math.random() * 12 + 6,
    }));

    setSparkles(newSparkles);

    setTimeout(() => {
      if (completedTaskId) {
        dispatchOnboardingTaskCelebrationEnded(completedTaskId);
      }
      setCelebrating(false);
      setActiveTaskId(null);
      dismissOnboardingTaskCompanion();
    }, 4500);
  }, [activeTaskId]);

  // Listen to DB hydration / completion changes
  useEffect(() => {
    if (typeof window === "undefined") return;

    const onProgress = (event: Event) => {
      const detail = (event as CustomEvent<OnboardingProgressEventDetail>).detail;
      if (!detail) return;

      if (detail.taskId === "reset" || detail.taskId === "hydrate") {
        syncStepsFromDb();
        return;
      }

      // If active task completed globally, trigger local step completion & celebration!
      if (detail.taskId === activeTaskId) {
        const count =
          ONBOARDING_REWARD_TASKS.find((t) => t.id === activeTaskId)?.steps.length ??
          (activeTaskId === PLAY_DAILYDOSE_TASK_ID
            ? PLAY_DAILYDOSE_COMPANION_TASK.steps.length
            : 0);
        setStepsProgress(Array.from({ length: count }, () => true));
        triggerCelebration();
      } else if (detail.taskId.startsWith(`${activeTaskId}_step_`)) {
        syncStepsFromDb();
      }
    };

    window.addEventListener(ONBOARDING_PROGRESS_EVENT, onProgress);

    const onStepProgress = (event: Event) => {
      const detail = (event as CustomEvent<{ taskId: string; stepIndex: number }>).detail;
      if (!detail || detail.taskId !== activeTaskId) return;
      syncStepsFromDb();
    };

    const onLessonsSubject = () => {
      if (activeTaskId === "lessons") syncStepsFromDb();
    };

    const onEarnBuddyProgress = () => {
      if (activeTaskId === "earn_buddy") syncStepsFromDb();
    };

    const onPrepMcqComplete = () => {
      triggerCelebration();
    };

    window.addEventListener("edublast-onboarding-step-progress", onStepProgress);
    window.addEventListener(LESSONS_SUBJECT_SELECTED_EVENT, onLessonsSubject);
    window.addEventListener(EARN_BUDDY_COMPANION_PROGRESS_EVENT, onEarnBuddyProgress);
    const onDailyLessonsComplete = () => {
      if (activeTaskId === "lessons") syncStepsFromDb();
    };

    const onDailyLessonsProgressPanel = () => {
      if (activeTaskId === "lessons") syncStepsFromDb();
    };

    window.addEventListener(DAILY_LESSONS_CHECKLIST_COMPLETE_EVENT, onDailyLessonsComplete);
    window.addEventListener(DAILY_LESSONS_PROGRESS_PANEL_EVENT, onDailyLessonsProgressPanel);
    return () => {
      window.removeEventListener(ONBOARDING_PROGRESS_EVENT, onProgress);
      window.removeEventListener("edublast-onboarding-step-progress", onStepProgress);
      window.removeEventListener(LESSONS_SUBJECT_SELECTED_EVENT, onLessonsSubject);
      window.removeEventListener(EARN_BUDDY_COMPANION_PROGRESS_EVENT, onEarnBuddyProgress);
      window.removeEventListener("edublast-onboarding-prep-mcq-complete", onPrepMcqComplete);
      window.removeEventListener(DAILY_LESSONS_CHECKLIST_COMPLETE_EVENT, onDailyLessonsComplete);
      window.removeEventListener(DAILY_LESSONS_PROGRESS_PANEL_EVENT, onDailyLessonsProgressPanel);
    };
  }, [activeTaskId, syncStepsFromDb, triggerCelebration]);

  /** Reconcile companion steps when navigating deeper in a task flow. */
  useEffect(() => {
    if (!activeTaskId || celebrating) return;
    syncStepsFromDb();

    if (activeTaskId === "prep_classes") {
      if (pathname === "/classrooms" || pathname.startsWith("/classrooms/")) {
        markPrepClassesStep0FromClassroomsPage();
      }
    }

    if (activeTaskId === "news_blog") {
      if (pathname === "/news-blog" || pathname.startsWith("/news-blog/")) {
        if (pathname === "/news-blog") {
          markNewsBlogCompanionListOpened();
        } else {
          markNewsBlogCompanionArticleOpened();
        }
        reconcileNewsBlogCompanionSteps();
      }
    }

    if (activeTaskId === "gyan_plus") {
      reconcileGyanPlusCompanionSteps();
    }

    if (activeTaskId === PLAY_DAILYDOSE_TASK_ID && pathname === "/play") {
      markPlayDailyDoseCompanionOnPlayPage();
    }
  }, [activeTaskId, pathname, celebrating, syncStepsFromDb]);

  // Function to complete a single step and save to Database
  const completeStep = useCallback(
    (stepIndex: number) => {
      if (!activeTaskId || stepsProgress[stepIndex]) return;
      // Magic Wall / Lessons substeps are driven from their pages only.
      if (activeTaskId === "magic_wall" && stepIndex >= 1) return;
      if (activeTaskId === "lessons" && stepIndex >= 1) return;
      if (activeTaskId === "prep_classes") return;
      if (activeTaskId === "prep_mcq") return;
      if (activeTaskId === "gyan_plus" && stepIndex >= 1) return;
      if (activeTaskId === "earn_buddy") return;
      if (activeTaskId === "earn_challenge") return;
      if (activeTaskId === "news_blog") return;
      if (activeTaskId === "profile") return;
      if (activeTaskId === PLAY_DAILYDOSE_TASK_ID) return;

      // Persist step completion locally + Database!
      markOnboardingStepComplete(activeTaskId, stepIndex);

      // Update local state for immediate feedback
      setStepsProgress((prev) => {
        const next = [...prev];
        next[stepIndex] = true;

        // Check if all steps are completed (earn_buddy completes only via accepted invite on server)
        const isTakingQuiz =
          typeof document !== "undefined" && !!document.querySelector('div[role="radiogroup"]');
        if (
          next.every((step) => step) &&
          activeTaskId !== "earn_buddy" &&
          activeTaskId !== "earn_challenge" &&
          activeTaskId !== "news_blog" &&
          activeTaskId !== "profile" &&
          !(activeTaskId === "prep_mcq" && isTakingQuiz)
        ) {
          setTimeout(() => {
            markOnboardingTaskComplete(activeTaskId, { showChecklistToast: true });
            triggerCelebration();
          }, 600);
        }
        return next;
      });
    },
    [activeTaskId, stepsProgress, triggerCelebration]
  );

  // ----------------------------------------------------
  // Dynamic Real-time Event Checks (Auto-ticking Engine)
  // ----------------------------------------------------
  useEffect(() => {
    if (!activeTaskId || celebrating) return;

    // -- 1. PATHNAME CHECK (Step 0 is usually path entry) --
    if (activeTaskId === "magic_wall" && pathname === "/magic-wall") {
      completeStep(0);
    } else if (activeTaskId === "edufund" && pathname.startsWith("/edufund")) {
      completeStep(0);
    }

    // -- 2. SCROLL CHECK (Scrolling feeds, reading articles) --
    const handleScroll = () => {
      const scrollY = window.scrollY;

      if (activeTaskId === "edufund" && pathname === "/edufund" && scrollY > 100) {
        completeStep(1); // read tiers
      }
    };

    // -- 3. CLICK CHECKS (Clicks buttons, upvotes, saves, attempts) --
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;

      // Ignore any clicks that occur inside dialogs (like OnboardingRewardDialog) or inside the task companion itself
      if (
        target.closest('[role="dialog"]') ||
        target.closest("[data-companion]") ||
        target.closest('button[aria-label*="task companion"]')
      ) {
        return;
      }

      const text = (target.textContent || "").toLowerCase().trim();

      // EDUFUND
      if (activeTaskId === "edufund" && pathname === "/edufund") {
        if (text.includes("create proposal") || text.includes("proposal")) {
          completeStep(2);
          completeStep(3); // see details
        }
      }

      // LESSONS — subject card on /explore-1 hub
      if (
        activeTaskId === "lessons" &&
        (pathname === "/explore-1" || pathname.startsWith("/explore-1/"))
      ) {
        if (
          target.closest('section[aria-labelledby="browse-by-subject-heading"] button') ||
          target.closest('[data-lessons-subject-chip="1"]')
        ) {
          completeStep(0);
        }
      }

      // EARN BUDDY — copy / share on /refer-earn
      if (activeTaskId === "earn_buddy" && pathname.startsWith("/refer-earn")) {
        if (target.closest('[data-earn-buddy-copy="1"]')) {
          markEarnBuddyCompanionLinkCopied();
        } else if (target.closest('[data-earn-buddy-share="1"]')) {
          markEarnBuddyCompanionLinkShared();
        }
      }

      // PLAY DAILYDOSE — DailyDose buttons on /play
      if (activeTaskId === PLAY_DAILYDOSE_TASK_ID && pathname === "/play") {
        if (target.closest('[data-play-dailydose="1"]')) {
          markPlayDailyDoseCompanionStarted();
          syncStepsFromDb();
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("click", handleGlobalClick);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("click", handleGlobalClick);
      if (timersRef.current["watch_class"]) {
        clearTimeout(timersRef.current["watch_class"]);
        delete timersRef.current["watch_class"];
      }
    };
  }, [activeTaskId, pathname, completeStep, celebrating, syncStepsFromDb]);

  // ----------------------------------------------------
  // Custom Raw Pointer Events Draggability & Snapping
  // ----------------------------------------------------
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (isMinimized) {
      if (!target.closest("[data-companion-drag-handle]")) return;
    } else if (
      target.closest("button, a, input, textarea, [data-companion-no-drag]") ||
      target.closest("[data-companion-scroll]")
    ) {
      return;
    }

    e.preventDefault();
    const surface = isMinimized ? "launcher" : "panel";
    const pos = surface === "launcher" ? launcherPos : panelPos;
    dragRef.current.isDragging = true;
    dragRef.current.surface = surface;
    dragRef.current.startX = e.clientX;
    dragRef.current.startY = e.clientY;
    dragRef.current.initialX = pos.x;
    dragRef.current.initialY = pos.y;

    if (containerRef.current) {
      containerRef.current.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.isDragging) return;

    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const minimized = dragRef.current.surface === "launcher";

    const next = clampCompanionPosition(
      {
        x: dragRef.current.initialX + dx,
        y: dragRef.current.initialY + dy,
      },
      {
        minimized,
        width: containerRef.current?.offsetWidth,
        height: containerRef.current?.offsetHeight,
      }
    );

    if (minimized) {
      setLauncherPos(next);
    } else {
      setPanelPos(next);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.isDragging) return;

    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const minimized = dragRef.current.surface === "launcher";
    dragRef.current.isDragging = false;

    if (containerRef.current) {
      containerRef.current.releasePointerCapture(e.pointerId);
    }

    const finalPos = clampCompanionPosition(
      {
        x: dragRef.current.initialX + dx,
        y: dragRef.current.initialY + dy,
      },
      {
        minimized,
        width: containerRef.current?.offsetWidth,
        height: containerRef.current?.offsetHeight,
      }
    );
    if (minimized) {
      setLauncherPos(finalPos);
      if (activeTaskId) saveCompanionPosition(activeTaskId, finalPos);
    } else {
      setPanelPos(finalPos);
      if (activeTaskId) savePanelPosition(activeTaskId, finalPos);
    }
  };

  useEffect(() => {
    if (!isMounted || !activeTaskId) return;
    const onResize = () => {
      const clampOpts = {
        minimized: isMinimized,
        width: containerRef.current?.offsetWidth,
        height: containerRef.current?.offsetHeight,
      };
      if (isMinimized) {
        setLauncherPos((prev) => clampCompanionPosition(prev, clampOpts));
      } else {
        setPanelPos((prev) => clampCompanionPosition(prev, clampOpts));
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [isMounted, activeTaskId, isMinimized]);

  const companionLaunched =
    Boolean(activeTaskId) && isOnboardingTaskCompanionLaunched(activeTaskId || undefined);
  const onTaskFlowPath =
    Boolean(activeTaskId) && isPathRelevantForOnboardingTask(activeTaskId as string, pathname);

  if (!isMounted || !activeTaskId || !activeTask || !companionLaunched || !onTaskFlowPath) {
    return null;
  }

  const sparkleOverlay =
    celebrating && sparkles.length > 0 ? (
      <div className="pointer-events-none absolute inset-0 z-50 overflow-visible">
        {sparkles.map((sp) => (
          <div
            key={sp.id}
            style={{
              position: "absolute",
              left: `${sp.x}px`,
              top: `${sp.y}px`,
              color: sp.color,
              fontSize: `${sp.size}px`,
              animation: `float-down-sparkle 3s cubic-bezier(0.1, 0.8, 0.3, 1) forwards`,
              animationDelay: `${sp.delay}s`,
            }}
            className="drop-shadow-[0_0_8px_rgba(139,92,246,0.5)] font-bold text-lg"
          >
            {sp.emoji ? sp.emoji : "✦"}
          </div>
        ))}
      </div>
    ) : null;

  const themeBorder =
    activeTask.color === "teal" ? "#10b981" : activeTask.color === "amber" ? "#f59e0b" : "#8b5cf6";

  return (
    <>
      {!isMinimized ? (
        <div
          ref={containerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          data-companion="root"
          style={{
            position: "fixed",
            left: `${panelPos.x}px`,
            top: `${panelPos.y}px`,
            zIndex: 62,
            touchAction: "none",
            transition: dragRef.current.isDragging
              ? "none"
              : "left 0.2s ease-out, top 0.2s ease-out",
          }}
          className="relative w-[min(calc(100vw-1.5rem),310px)] max-h-[min(90dvh,520px)] select-none pointer-events-auto"
        >
          {sparkleOverlay}
          <div
            className="relative flex w-full max-h-[min(90dvh,520px)] flex-col gap-3.5 overflow-hidden rounded-2xl border border-white/10 bg-[#090f1d]/95 p-4 text-white shadow-2xl backdrop-blur-xl"
            data-companion="popup"
          >
            <div
              className="absolute bottom-0 left-0 right-0 h-1.5"
              style={{
                background: `linear-gradient(to right, ${activeTask.color === "teal" ? "#047857, #10b981" : activeTask.color === "amber" ? "#b45309, #f59e0b" : "#6d28d9, #8b5cf6"})`,
              }}
            />
            <div className="flex cursor-grab items-center justify-between border-b border-white/5 pb-2 active:cursor-grabbing touch-none select-none">
              <div className="flex flex-1 min-w-0 items-center gap-2">
                <GripVertical className="h-4 w-4 shrink-0 text-zinc-600" aria-hidden />
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5"
                  style={{
                    color:
                      activeTask.color === "teal"
                        ? "#34d399"
                        : activeTask.color === "amber"
                          ? "#fbbf24"
                          : "#a78bfa",
                  }}
                >
                  <activeTask.icon className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h4 className="text-[13px] font-black tracking-wide text-zinc-100 line-clamp-1">
                    {activeTask.title}
                  </h4>
                  <p className="text-[9px] font-extrabold uppercase tracking-wider text-zinc-500 font-mono mt-0.5">
                    Task Companion
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 border border-emerald-500/25 text-[10px] font-black font-mono text-emerald-400">
                  <Coins className="h-3 w-3" />
                  {dailyLessonsActive ? "+30 RDM" : "+10 RDM"}
                </span>
                <button
                  type="button"
                  data-companion-no-drag
                  onClick={minimizeCompanionPanel}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white transition-colors"
                  title="Minimize companion"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
            {/* Steps Checklist */}
            <div
              data-companion-scroll
              className="flex flex-col gap-2.5 overflow-y-auto overscroll-contain pr-0.5 min-h-0 flex-1"
            >
              {activeTask.steps.map((step, idx) => {
                const done = stepsProgress[idx];
                return (
                  <div
                    key={idx}
                    onClick={() => {
                      if (
                        !isAdminManualOnboardingChecklist() ||
                        activeTaskId === "magic_wall" ||
                        activeTaskId === "lessons" ||
                        activeTaskId === "gyan_plus"
                      ) {
                        return;
                      }
                      completeStep(idx);
                    }}
                    className={`flex items-start gap-2.5 p-2 rounded-xl border transition-all ${
                      isAdminManualOnboardingChecklist() &&
                      activeTaskId !== "magic_wall" &&
                      activeTaskId !== "lessons" &&
                      activeTaskId !== "gyan_plus"
                        ? "cursor-pointer"
                        : "cursor-default"
                    } ${
                      done
                        ? "bg-[#052e16]/30 border-emerald-500/10 hover:bg-[#052e16]/50"
                        : "bg-[#111827]/40 border-white/5 hover:bg-white/5"
                    }`}
                  >
                    {/* Neon custom check badge */}
                    <div
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black border transition-all ${
                        done
                          ? "bg-emerald-500 border-emerald-400 text-slate-950 shadow-[0_0_8px_rgba(16,185,129,0.35)]"
                          : "border-zinc-700 bg-[#1f2937]/50 text-zinc-400"
                      }`}
                    >
                      {done ? <Check className="h-3 w-3 stroke-[3]" /> : idx + 1}
                    </div>

                    <p
                      className={`text-xs leading-[1.35] font-bold select-text ${
                        done ? "text-emerald-400/70 line-through" : "text-zinc-300"
                      }`}
                    >
                      {step}
                    </p>
                  </div>
                );
              })}
            </div>

            {activeTaskId === "magic_wall" && activeTask && (
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Clock
                      className="h-4 w-4 shrink-0 text-emerald-400 animate-pulse"
                      aria-hidden
                    />
                    <p className="text-[11px] font-medium text-zinc-300 leading-snug">
                      {!stepsProgress[0]
                        ? "Open Magic Wall from the menu"
                        : !stepsProgress[1]
                          ? "Select at least one topic to read"
                          : !stepsProgress[2]
                            ? 'Tap "Save changes" on your basket'
                            : "All steps done — +10 RDM on the board"}
                    </p>
                  </div>
                  <span className="shrink-0 text-[10px] font-extrabold uppercase tracking-wide text-emerald-300">
                    {activeTask.time}
                  </span>
                </div>
              </div>
            )}

            {activeTaskId === "lessons" && activeTask && (
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Clock
                      className="h-4 w-4 shrink-0 text-emerald-400 animate-pulse"
                      aria-hidden
                    />
                    <p className="text-[11px] font-medium text-zinc-300 leading-snug">
                      {dailyLessonsActive
                        ? !stepsProgress[0]
                          ? "Open Lessons from today's checklist"
                          : !stepsProgress[1]
                            ? "Pick a chapter and open a sub-topic"
                            : !stepsProgress[2]
                              ? "Use Lessons / Progress on the left — work through the checklist"
                              : !stepsProgress[3]
                                ? "When you're done, tap Mark as complete"
                                : "All steps done — +30 RDM on today's checklist"
                        : !stepsProgress[0]
                          ? "Pick Physics, Chemistry, or Maths on Lessons"
                          : !stepsProgress[1]
                            ? "Save your chapter picks"
                            : !stepsProgress[2]
                              ? "Open a sub-topic from your chapters"
                              : !stepsProgress[3]
                                ? "Try the quiz or swipe InstaCue cards"
                                : "All steps done — +10 RDM on the board"}
                    </p>
                  </div>
                  <span className="shrink-0 text-[10px] font-extrabold uppercase tracking-wide text-emerald-300">
                    {activeTask.time}
                  </span>
                </div>
              </div>
            )}

            {activeTaskId === "prep_classes" && activeTask && (
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Clock
                      className="h-4 w-4 shrink-0 text-emerald-400 animate-pulse"
                      aria-hidden
                    />
                    <p className="text-[11px] font-medium text-zinc-300 leading-snug">
                      {!stepsProgress[0]
                        ? "Open Classrooms (via Prep + Mock or menu)"
                        : !stepsProgress[1]
                          ? "Tap a class to open it"
                          : !stepsProgress[2]
                            ? "Play the intro video on Home"
                            : !stepsProgress[3]
                              ? "Open the Live tab for sessions"
                              : "All steps done — +10 RDM on the board"}
                    </p>
                  </div>
                  <span className="shrink-0 text-[10px] font-extrabold uppercase tracking-wide text-emerald-300">
                    {activeTask.time}
                  </span>
                </div>
              </div>
            )}

            {activeTaskId === "edufund" && activeTask && (
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Clock
                      className="h-4 w-4 shrink-0 text-emerald-400 animate-pulse"
                      aria-hidden
                    />
                    <p className="text-[11px] font-medium text-zinc-300 leading-snug">
                      {!stepsProgress[0]
                        ? "Open EduFund from the menu"
                        : !stepsProgress[1]
                          ? "Scroll to read grant tiers"
                          : !stepsProgress[2]
                            ? "Tap Create proposal"
                            : !stepsProgress[3]
                              ? "Review your proposal details"
                              : "All steps done — +10 RDM on the board"}
                    </p>
                  </div>
                  <span className="shrink-0 text-[10px] font-extrabold uppercase tracking-wide text-emerald-300">
                    {activeTask.time}
                  </span>
                </div>
              </div>
            )}

            {activeTaskId === "gyan_plus" &&
              gyanBrowseTimer &&
              !stepsProgress[0] &&
              pathname.startsWith("/doubts") && (
                <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Clock
                        className={`h-4 w-4 shrink-0 text-amber-400 ${gyanBrowseTimer.running ? "animate-pulse" : ""}`}
                        aria-hidden
                      />
                      <div className="min-w-0">
                        <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-300/90">
                          Browse timer
                        </p>
                        <p className="text-[11px] font-medium text-zinc-300 leading-snug">
                          {gyanBrowseTimer.notStarted
                            ? "Starting… stay on the Doubt Wall"
                            : gyanBrowseTimer.running
                              ? "Keep browsing the feed"
                              : "Time’s up — step will tick when saved"}
                        </p>
                      </div>
                    </div>
                    <span
                      className="shrink-0 font-mono text-lg font-black tabular-nums text-amber-300"
                      aria-live="polite"
                    >
                      {formatGyanBrowseCountdown(gyanBrowseTimer.secondsLeft)}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/30">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all duration-1000 ease-linear"
                      style={{ width: `${gyanBrowseTimer.progressPct}%` }}
                    />
                  </div>
                </div>
              )}

            {activeTaskId === "gyan_plus" &&
              gyanBrowseTimer &&
              !stepsProgress[0] &&
              !pathname.startsWith("/doubts") && (
                <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] font-medium text-amber-200/90">
                  Open <span className="font-bold">Gyan++</span> (Doubt Wall) to start the 1:00
                  browse timer for step 1.
                </p>
              )}

            {activeTaskId === "earn_buddy" && activeTask && (
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Clock className="h-4 w-4 shrink-0 text-amber-400 animate-pulse" aria-hidden />
                    <p className="text-[11px] font-medium text-zinc-300 leading-snug">
                      {stepsProgress[2]
                        ? "Buddy joined — checklist will update"
                        : stepsProgress[1]
                          ? "Waiting for your buddy to accept and join"
                          : stepsProgress[0]
                            ? "Share your invite link with a friend"
                            : "Copy your invite link below or share it"}
                    </p>
                  </div>
                  <span className="shrink-0 text-[10px] font-extrabold uppercase tracking-wide text-amber-300">
                    {activeTask.time}
                  </span>
                </div>
              </div>
            )}

            {activeTaskId === "news_blog" && activeTask && (
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Clock className="h-4 w-4 shrink-0 text-amber-400 animate-pulse" aria-hidden />
                    <p className="text-[11px] font-medium text-zinc-300 leading-snug">
                      {!stepsProgress[0]
                        ? "Open News & Blogs from the menu"
                        : !stepsProgress[1]
                          ? "Tap any article to open it"
                          : !stepsProgress[2]
                            ? "Scroll to read the full piece"
                            : "Done — head back to the checklist"}
                    </p>
                  </div>
                  <span className="shrink-0 text-[10px] font-extrabold uppercase tracking-wide text-amber-300">
                    {activeTask.time}
                  </span>
                </div>
              </div>
            )}

            {activeTaskId === "profile" && activeTask && (
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Clock className="h-4 w-4 shrink-0 text-amber-400 animate-pulse" aria-hidden />
                    <p className="text-[11px] font-medium text-zinc-300 leading-snug">
                      {!stepsProgress[0]
                        ? "Open Basic information on your profile"
                        : !stepsProgress[1]
                          ? "Tap Edit and fill required fields"
                          : !stepsProgress[2]
                            ? "Save personal info (all required fields)"
                            : !stepsProgress[3]
                              ? "Upload your profile photo below"
                              : "Profile complete — +10 RDM on the board"}
                    </p>
                  </div>
                  <span className="shrink-0 text-[10px] font-extrabold uppercase tracking-wide text-amber-300">
                    {activeTask.time}
                  </span>
                </div>
              </div>
            )}

            {activeTaskId === "earn_challenge" && activeTask && (
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Clock
                      className="h-4 w-4 shrink-0 text-emerald-400 animate-pulse"
                      aria-hidden
                    />
                    <p className="text-[11px] font-medium text-zinc-300 leading-snug">
                      {!stepsProgress[0]
                        ? "Pick a challenge & tap Start challenge"
                        : !stepsProgress[1]
                          ? "Finish your speed round"
                          : !stepsProgress[2]
                            ? "Post your result to the community feed"
                            : "All steps done — +10 RDM on the board"}
                    </p>
                  </div>
                  <span className="shrink-0 text-[10px] font-extrabold uppercase tracking-wide text-emerald-300">
                    {activeTask.time}
                  </span>
                </div>
              </div>
            )}

            {activeTaskId === "prep_mcq" && activeTask && (
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Clock
                      className="h-4 w-4 shrink-0 text-emerald-400 animate-pulse"
                      aria-hidden
                    />
                    <p className="text-[11px] font-medium text-zinc-300 leading-snug">
                      {!stepsProgress[0]
                        ? 'On Prep + Mock, tap "View all" on Mock tests'
                        : !stepsProgress[1]
                          ? "Open the CBSE MCQ's tab"
                          : !stepsProgress[2]
                            ? "Pick a chapter and tap Quiz to start"
                            : !stepsProgress[3]
                              ? "Read the explanation for at least one answer"
                              : "All steps done — +10 RDM on the board"}
                    </p>
                  </div>
                  <span className="shrink-0 text-[10px] font-extrabold uppercase tracking-wide text-emerald-300">
                    {activeTask.time}
                  </span>
                </div>
              </div>
            )}

            {activeTaskId === PLAY_DAILYDOSE_TASK_ID && activeTask && (
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Clock
                      className="h-4 w-4 shrink-0 text-emerald-400 animate-pulse"
                      aria-hidden
                    />
                    <p className="text-[11px] font-medium text-zinc-300 leading-snug">
                      {!stepsProgress[0]
                        ? "You're on Play — pick Academic or Funbrain"
                        : !stepsProgress[1]
                          ? "Tap DailyDose on either arena card"
                          : !stepsProgress[2]
                            ? "Answer all DailyDose questions"
                            : !stepsProgress[3]
                              ? "View today's leaderboard"
                              : "DailyDose done — +10 RDM on the board"}
                    </p>
                  </div>
                  <span className="shrink-0 text-[10px] font-extrabold uppercase tracking-wide text-emerald-300">
                    {activeTask.time}
                  </span>
                </div>
              </div>
            )}

            {/* Bottom Control & Progress Bar */}
            <div className="flex flex-col gap-2 border-t border-white/5 pt-2 pb-1.5 select-none">
              {/* Progress Label */}
              <div className="flex justify-between items-center text-[10px] font-black text-zinc-400">
                <span className="uppercase tracking-wider font-mono">Progress</span>
                <span className="font-mono text-zinc-300">
                  {stepCount > 0
                    ? Math.round((stepsProgress.filter(Boolean).length / stepCount) * 100)
                    : 0}
                  %
                </span>
              </div>

              {/* Glass Progress Bar */}
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/5 border border-white/5 p-0.5">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${stepCount > 0 ? (stepsProgress.filter(Boolean).length / stepCount) * 100 : 0}%`,
                    background: `linear-gradient(to right, ${activeTask.color === "teal" ? "#34d399, #10b981" : activeTask.color === "amber" ? "#fbbf24, #f59e0b" : "#a78bfa, #8b5cf6"})`,
                  }}
                />
              </div>

              {/* Actions */}
              <div className="mt-1 flex items-center justify-end gap-2">
                <button
                  onClick={minimizeCompanionPanel}
                  className="flex items-center gap-0.5 text-[10px] font-bold text-zinc-400 hover:text-white transition-colors uppercase tracking-wider"
                >
                  Minimize
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div
          ref={containerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          data-companion="root"
          style={{
            position: "fixed",
            left: `${launcherPos.x}px`,
            top: `${launcherPos.y}px`,
            zIndex: 62,
            touchAction: "none",
            transition: dragRef.current.isDragging
              ? "none"
              : launcherDocking
                ? "left 0.48s cubic-bezier(0.22, 1, 0.36, 1), top 0.48s cubic-bezier(0.22, 1, 0.36, 1)"
                : "left 0.2s ease-out, top 0.2s ease-out",
          }}
          className={`relative select-none pointer-events-auto ${launcherDocking ? "companion-launcher-docking" : ""}`}
        >
          {sparkleOverlay}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              expandCompanionPanel();
            }}
            className="group relative flex h-12 w-12 items-center justify-center rounded-full bg-[#0a0f18]/90 text-white shadow-2xl backdrop-blur-md active:scale-95 transition-transform companion-launcher-chip"
            style={{
              border: `2px solid ${themeBorder}40`,
              boxShadow: `0 0 15px ${themeBorder}20`,
            }}
            aria-label="Open task companion"
          >
            <span
              className="absolute -inset-1 rounded-full animate-ping opacity-45"
              style={{
                backgroundColor: `${themeBorder}30`,
                animationDuration: "2.2s",
              }}
            />
            <span
              className="absolute inset-0 rounded-full border border-white/10 group-hover:scale-105 transition-transform"
              style={{
                background: "radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 80%)",
              }}
            />
            <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 border border-violet-400/35 text-[9px] font-extrabold font-mono text-white shadow-md">
              {stepsProgress.filter(Boolean).length}/{stepCount || 1}
            </span>
            {activeTaskId === "gyan_plus" &&
              gyanBrowseTimer &&
              !stepsProgress[0] &&
              (gyanBrowseTimer.running || !gyanBrowseTimer.done) && (
                <span
                  className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border border-amber-500/40 bg-amber-950/95 px-1.5 py-0.5 font-mono text-[9px] font-bold tabular-nums text-amber-300 shadow-lg"
                  aria-live="polite"
                >
                  {formatGyanBrowseCountdown(gyanBrowseTimer.secondsLeft)}
                </span>
              )}
            <activeTask.icon
              className="relative h-5.5 w-5.5 shrink-0 transition-transform group-hover:scale-110 pointer-events-none"
              style={{
                color:
                  activeTask.color === "teal"
                    ? "#34d399"
                    : activeTask.color === "amber"
                      ? "#fbbf24"
                      : "#a78bfa",
              }}
            />
          </button>
          <button
            type="button"
            data-companion-drag-handle
            className="absolute -right-0.5 -bottom-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-white/15 bg-zinc-900/95 text-zinc-400 shadow-md cursor-grab active:cursor-grabbing hover:text-white"
            aria-label="Drag task companion"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-3 w-3 pointer-events-none" />
          </button>
        </div>
      )}

      {/* Embedded CSS custom styles directly inside standard tag to maintain zero package dependencies */}
      <style>{`
        @keyframes float-down-sparkle {
          0% {
            transform: translateY(0) scale(1) rotate(0deg);
            opacity: 1;
          }
          50% {
            opacity: 0.9;
          }
          100% {
            transform: translateY(320px) scale(0.3) rotate(320deg);
            opacity: 0;
          }
        }
        @keyframes companion-launcher-dock-pulse {
          0% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.45);
          }
          70% {
            transform: scale(1.06);
            box-shadow: 0 0 0 14px rgba(139, 92, 246, 0);
          }
          100% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(139, 92, 246, 0);
          }
        }
        .companion-launcher-docking .companion-launcher-chip {
          animation: companion-launcher-dock-pulse 0.48s ease-out;
        }
      `}</style>
    </>
  );
}
