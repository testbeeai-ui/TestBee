import { isOnboardingTaskCompanionLaunched } from "@/lib/onboarding/onboardingTaskCompanion";
import {
  clearOnboardingStepComplete,
  getOnboardingProgress,
  markOnboardingStepComplete,
  markOnboardingTaskComplete,
  migrateLessonsStep12SemanticSwapV2IfNeeded,
} from "@/lib/subscription/freeTrialClient";

const TASK_ID = "lessons";

const SUBTOPIC_OPENED_SESSION_KEY = "edublast.onboarding_lessons_subtopic_opened_v1";
const CHAPTERS_SAVED_SESSION_KEY = "edublast.onboarding_lessons_chapters_saved_v1";
const QUIZ_OR_INSTACUE_SESSION_KEY = "edublast.onboarding_lessons_quiz_instacue_v1";
const SUBJECT_SELECTED_SESSION_KEY = "edublast.onboarding_lessons_subject_selected_v1";

/** Fired when the learner picks Physics / Chemistry / Math on /explore-1. */
export const LESSONS_SUBJECT_SELECTED_EVENT = "edublast-lessons-subject-selected";

/** Clears ephemeral session markers (persisted checklist keys in localStorage are unchanged). */
export function clearLessonsCompanionSessionMarkers(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(SUBTOPIC_OPENED_SESSION_KEY);
    window.sessionStorage.removeItem(CHAPTERS_SAVED_SESSION_KEY);
    window.sessionStorage.removeItem(QUIZ_OR_INSTACUE_SESSION_KEY);
    window.sessionStorage.removeItem(SUBJECT_SELECTED_SESSION_KEY);
  } catch {
    /* ignore private mode */
  }
  clearLessonsOnboardingQuizOrInstacueStep();
  clearLessonsOnboardingSubtopicStep();
  clearLessonsOnboardingChaptersSavedStep();
}

/** Lessons step tracking only after "Open task" from the site-tour drawer. */
export function isLessonsOnboardingCompanionActive(): boolean {
  return isOnboardingTaskCompanionLaunched(TASK_ID);
}

function stepKey(index: number): string {
  return `${TASK_ID}_step_${index}`;
}

function canTrack(): boolean {
  return typeof window !== "undefined";
}

function trackingEnabled(): boolean {
  return canTrack() && isLessonsOnboardingCompanionActive();
}

function setSessionFlag(key: string): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(key, "1");
}

function hasSessionFlag(key: string): boolean {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(key) === "1";
}

function syncStep(index: number, shouldComplete: boolean): void {
  if (!trackingEnabled()) return;
  migrateLessonsStep12SemanticSwapV2IfNeeded();
  const key = stepKey(index);
  const progress = getOnboardingProgress();
  if (shouldComplete && !progress[key]) {
    markOnboardingStepComplete(TASK_ID, index);
  } else if (!shouldComplete && progress[key]) {
    clearOnboardingStepComplete(TASK_ID, index);
  }
}

function maybeCompleteLessonsTask(): void {
  if (!trackingEnabled()) return;
  if (getOnboardingProgress()[TASK_ID]) return;
  const progress = getOnboardingProgress();
  const allDone = [0, 1, 2, 3].every((i) => progress[stepKey(i)]);
  if (allDone) {
    markOnboardingTaskComplete(TASK_ID);
  }
}

/** Drop legacy 5th step (revision) from older checklist builds. */
function clearLegacyRevisionStep(): void {
  if (!canTrack()) return;
  const progress = getOnboardingProgress();
  if (progress[stepKey(4)]) {
    clearOnboardingStepComplete(TASK_ID, 4);
  }
}

/** Step 0 — picked a subject on the Lessons hub (session flag survives until companion is active). */
export function markLessonsOnboardingSubjectSelected(): void {
  if (!canTrack()) return;
  setSessionFlag(SUBJECT_SELECTED_SESSION_KEY);
  window.dispatchEvent(new CustomEvent(LESSONS_SUBJECT_SELECTED_EVENT));
  if (!trackingEnabled()) return;
  syncStep(0, true);
  maybeCompleteLessonsTask();
}

/** Step 2 — opened a sub-topic (UI checklist item 3). Step 1 auto-completes when chapter lock is off or chapters were saved. */
export function markLessonsOnboardingSubtopicOpened(options?: {
  chapterLockActive?: boolean;
}): void {
  setSessionFlag(SUBTOPIC_OPENED_SESSION_KEY);
  syncStep(2, true);
  const chaptersSaved = hasSessionFlag(CHAPTERS_SAVED_SESSION_KEY);
  if (options?.chapterLockActive === false || chaptersSaved) {
    syncStep(1, true);
  }
  maybeCompleteLessonsTask();
}

/** Step 1 — saved chapter picks on the free-trial chapter picker (UI checklist item 2). */
export function markLessonsOnboardingChaptersSaved(): void {
  setSessionFlag(CHAPTERS_SAVED_SESSION_KEY);
  syncStep(1, true);
  maybeCompleteLessonsTask();
}

/** Step 3 — picked a quiz option this session or validated an InstaCue card (not browse-only). */
export function markLessonsOnboardingQuizOrInstacue(): void {
  setSessionFlag(QUIZ_OR_INSTACUE_SESSION_KEY);
  syncStep(3, true);
  maybeCompleteLessonsTask();
}

/** Clears persisted step 3 (e.g. fresh Lessons launch before companion is active). */
export function clearLessonsOnboardingQuizOrInstacueStep(): void {
  if (!canTrack()) return;
  migrateLessonsStep12SemanticSwapV2IfNeeded();
  const key = stepKey(3);
  if (getOnboardingProgress()[key]) {
    clearOnboardingStepComplete(TASK_ID, 3);
  }
}

/** Clears persisted step 2 (opened sub-topic) when session flag is gone. */
export function clearLessonsOnboardingSubtopicStep(): void {
  if (!canTrack()) return;
  migrateLessonsStep12SemanticSwapV2IfNeeded();
  const key = stepKey(2);
  if (getOnboardingProgress()[key]) {
    clearOnboardingStepComplete(TASK_ID, 2);
  }
}

/** Clears persisted step 1 (saved chapters) when session flag is gone. */
export function clearLessonsOnboardingChaptersSavedStep(): void {
  if (!canTrack()) return;
  migrateLessonsStep12SemanticSwapV2IfNeeded();
  const key = stepKey(1);
  if (getOnboardingProgress()[key]) {
    clearOnboardingStepComplete(TASK_ID, 1);
  }
}

export type LessonsOnboardingReconcileInput = {
  subjectSelected: boolean;
  chapterLockActive: boolean;
  /** In-app Explore: learner focused a sub-topic card (not topic/chapter hub). */
  inAppSubtopicFocused?: boolean;
};

/** Align stored steps with session flags and basket state. */
export function reconcileLessonsOnboardingProgress(input: LessonsOnboardingReconcileInput): void {
  if (!trackingEnabled()) return;

  clearLegacyRevisionStep();

  const progress = getOnboardingProgress();
  const shouldHaveStep0 =
    input.subjectSelected ||
    hasSessionFlag(SUBJECT_SELECTED_SESSION_KEY) ||
    Boolean(progress[stepKey(0)]);
  /** Do not derive mid-task steps until step 0 is done (avoid explore “topic detail” false positives without a hub subject). */
  const subjectCommitted = shouldHaveStep0;
  const inAppCountsAsSubtopic = Boolean(subjectCommitted && input.inAppSubtopicFocused);
  const shouldHaveStep2Subtopic =
    subjectCommitted && (hasSessionFlag(SUBTOPIC_OPENED_SESSION_KEY) || inAppCountsAsSubtopic);
  const shouldHaveStep1Save =
    subjectCommitted &&
    (input.chapterLockActive
      ? hasSessionFlag(CHAPTERS_SAVED_SESSION_KEY)
      : shouldHaveStep2Subtopic);

  if (shouldHaveStep0) {
    syncStep(0, true);
  }
  syncStep(1, shouldHaveStep1Save);
  syncStep(2, shouldHaveStep2Subtopic);
  syncStep(3, subjectCommitted && hasSessionFlag(QUIZ_OR_INSTACUE_SESSION_KEY));

  maybeCompleteLessonsTask();
}
