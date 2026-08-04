/**
 * Persist Dive wizard progress in sessionStorage so Back / remount keeps selection.
 */

import type { Subject } from "@/types";
import type { DiveSubtopicCandidate, SuggestBatchState } from "@/lib/dive/suggestBatch";
import type { DiveStep } from "@/components/dive/diveTypes";

const STORAGE_KEY = "edublast:dive-wizard:v1";

export type DiveChapterSession = {
  chapterTitle: string;
  showSuggestions: boolean;
  /** Manual search panel open (mutually exclusive with AI suggestions in the UI). */
  showSearch?: boolean;
  searchQuery?: string;
  batchState: SuggestBatchState;
  order: number[];
  batchIndices: number[];
  seenBefore: number[];
};

export type DiveWizardPersisted = {
  step: DiveStep;
  maxReached: DiveStep;
  classLevel: 11 | 12;
  subject: Subject;
  chapterTitle: string;
  subtopic: DiveSubtopicCandidate | null;
  chapterSession: DiveChapterSession | null;
};

export function loadDiveWizardState(): DiveWizardPersisted | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as DiveWizardPersisted;
    if (![1, 2, 3, 4].includes(data.step)) return null;
    if (data.classLevel !== 11 && data.classLevel !== 12) return null;
    if (!["physics", "chemistry", "math"].includes(data.subject)) return null;
    return data;
  } catch {
    return null;
  }
}

export function saveDiveWizardState(state: DiveWizardPersisted): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearDiveWizardState(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
