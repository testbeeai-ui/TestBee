import { BookOpen } from "lucide-react";
import type { OnboardingTask } from "@/lib/onboarding/onboardingRewardTaskUi";
import {
  dispatchDailyChecklistReopen,
  completeDailyStreakTaskFlow,
  getActiveDailyStreakFlow,
  loadDailyChecklistCompleted,
} from "@/lib/onboarding/dailyChecklistTaskStorage";

const TRACKING_KEY = "edublast-daily-checklist-lessons-v1";
const COMPLETE_KEY = "edublast-daily-checklist-lessons-complete-v1";
const PROGRESS_PANEL_KEY = "edublast-daily-checklist-lessons-progress-panel-v1";
const REOPEN_DELAY_MS = 5000;

export const DAILY_LESSONS_CHECKLIST_COMPLETE_EVENT = "edublast-daily-lessons-checklist-complete";

export const DAILY_LESSONS_PROGRESS_PANEL_EVENT = "edublast-daily-lessons-progress-panel-opened";

const CURRICULUM_TOPIC_PATH = /^\/(cbse|icse)\/[^/]+\/class-\d+\//i;

/** Day-2+ companion copy — separate from site-tour ONBOARDING_REWARD_TASKS.lessons. */
export const LESSONS_DAILY_COMPANION_TASK: OnboardingTask = {
  id: "lessons",
  title: "Lessons",
  boardTitle: "Lessons",
  teaser: "Mark as complete on one sub-topic",
  time: "~5 min",
  steps: [
    "Open Lessons — your saved chapters from Day 1 are already there.",
    "Go to any chapter, topic, and sub-topic you want to study today.",
    "Work through the sub-topic at your pace (read, quiz, or Instacue).",
    "On the sub-topic, complete everything and tap Mark as complete.",
  ],
  hints: ["Saved chapters → sub-topic → Mark as complete"],
  href: "/explore-1",
  icon: BookOpen,
  color: "purple",
};

export function reconcileDailyLessonsCompanionSteps(pathname: string): boolean[] {
  const path = pathname.split("?")[0];
  const onSubtopic = CURRICULUM_TOPIC_PATH.test(path);
  const progressPanelOpened =
    typeof window !== "undefined" && window.sessionStorage.getItem(PROGRESS_PANEL_KEY) === "1";
  const markedComplete =
    typeof window !== "undefined" && window.sessionStorage.getItem(COMPLETE_KEY) === "1";

  return [
    isDailyLessonsChecklistTrackingActive(),
    onSubtopic,
    onSubtopic && progressPanelOpened,
    markedComplete,
  ];
}

/** Day-2 step 3 — learner opened the Lessons / Progress panel on a sub-topic. */
export function markDailyLessonsProgressPanelOpened(): void {
  if (!isDailyLessonsChecklistTrackingActive()) return;
  if (typeof window === "undefined") return;
  const wasOpen = window.sessionStorage.getItem(PROGRESS_PANEL_KEY) === "1";
  window.sessionStorage.setItem(PROGRESS_PANEL_KEY, "1");
  if (!wasOpen) {
    window.dispatchEvent(new CustomEvent(DAILY_LESSONS_PROGRESS_PANEL_EVENT));
  }
}

/** Day-2+ Lessons task — does not reset site-tour progress or chapter picks. */
export function startDailyLessonsChecklistTracking(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(TRACKING_KEY, "1");
  window.sessionStorage.removeItem(COMPLETE_KEY);
  window.sessionStorage.removeItem(PROGRESS_PANEL_KEY);
}

export function isDailyLessonsChecklistTrackingActive(): boolean {
  return typeof window !== "undefined" && window.sessionStorage.getItem(TRACKING_KEY) === "1";
}

export function clearDailyLessonsChecklistTracking(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(TRACKING_KEY);
  window.sessionStorage.removeItem(COMPLETE_KEY);
  window.sessionStorage.removeItem(PROGRESS_PANEL_KEY);
}

export type DailyLessonsCompleteInput = {
  userId: string;
  claimedAt: string | null | undefined;
  nowMs: number;
};

/** Credit Day-2 t2 when the student taps Mark as complete during the daily flow. */
export function handleDailyLessonsChecklistComplete(input: DailyLessonsCompleteInput): void {
  if (!isDailyLessonsChecklistTrackingActive()) return;
  if (typeof window === "undefined") return;
  if (window.sessionStorage.getItem(COMPLETE_KEY) === "1") return;

  window.sessionStorage.setItem(COMPLETE_KEY, "1");

  const flow = getActiveDailyStreakFlow();
  if (!flow || flow.dailyTaskId !== "t2" || flow.userId !== input.userId) return;

  const credited = completeDailyStreakTaskFlow("t2");
  if (!credited) return;

  const trialDayNumber = flow.trialDayNumber;
  const completed = loadDailyChecklistCompleted(input.userId, trialDayNumber);
  if (completed.length >= 6) {
    window.dispatchEvent(new CustomEvent(DAILY_LESSONS_CHECKLIST_COMPLETE_EVENT));
    return;
  }

  window.setTimeout(() => {
    dispatchDailyChecklistReopen("t2");
  }, REOPEN_DELAY_MS);

  window.dispatchEvent(new CustomEvent(DAILY_LESSONS_CHECKLIST_COMPLETE_EVENT));
}
