import { syncOnboardingTaskToServer } from "@/lib/subscription/onboardingRewardApi";
import { isOnboardingSiteTourClaimedLocally } from "@/lib/subscription/onboardingSiteTourClaimedLocal";

const PENDING_SYNC_KEY = "edublast.onboarding_pending_sync_v1";
const MAX_BACKGROUND_ATTEMPTS = 8;

type PendingOnboardingSync = {
  taskId: string;
  completed: boolean;
  attempts: number;
  updatedAt: number;
};

function canUseStorage(): boolean {
  return typeof window !== "undefined";
}

function readPendingSyncs(): PendingOnboardingSync[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(PENDING_SYNC_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is PendingOnboardingSync =>
        Boolean(item) &&
        typeof item === "object" &&
        typeof (item as PendingOnboardingSync).taskId === "string" &&
        typeof (item as PendingOnboardingSync).completed === "boolean"
    );
  } catch {
    return [];
  }
}

function writePendingSyncs(items: PendingOnboardingSync[]): void {
  if (!canUseStorage()) return;
  if (items.length === 0) {
    window.localStorage.removeItem(PENDING_SYNC_KEY);
    return;
  }
  window.localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(items));
}

/** Queue a checklist key for a later server sync (offline / transient API failure). */
export function enqueueOnboardingProgressSync(taskId: string, completed: boolean): void {
  if (!canUseStorage() || !taskId) return;
  if (isOnboardingSiteTourClaimedLocally()) return;
  const items = readPendingSyncs();
  const existing = items.find((item) => item.taskId === taskId);
  if (existing) {
    existing.completed = completed;
    existing.updatedAt = Date.now();
  } else {
    items.push({ taskId, completed, attempts: 0, updatedAt: Date.now() });
  }
  writePendingSyncs(items);
}

function removePendingSync(taskId: string): void {
  writePendingSyncs(readPendingSyncs().filter((item) => item.taskId !== taskId));
}

export function hasPendingOnboardingProgressSyncs(): boolean {
  return readPendingSyncs().length > 0;
}

export function clearPendingOnboardingProgressSyncs(): void {
  writePendingSyncs([]);
}

/**
 * Retry queued onboarding PATCHes. Returns the first taskId that still failed after this pass,
 * or null if everything synced (or nothing was queued).
 */
export async function flushPendingOnboardingProgressSyncs(): Promise<{
  stillPendingTaskId: string | null;
  lastError?: string;
}> {
  if (!canUseStorage()) return { stillPendingTaskId: null };
  if (isOnboardingSiteTourClaimedLocally()) {
    clearPendingOnboardingProgressSyncs();
    return { stillPendingTaskId: null };
  }
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    const pending = readPendingSyncs();
    return { stillPendingTaskId: pending[0]?.taskId ?? null, lastError: "offline" };
  }

  const items = readPendingSyncs();
  if (items.length === 0) return { stillPendingTaskId: null };

  let stillPendingTaskId: string | null = null;
  let lastError: string | undefined;

  await Promise.all(
    items.map(async (item) => {
      const result = await syncOnboardingTaskToServer(item.taskId, item.completed);
      if (result.ok) {
        removePendingSync(item.taskId);
        return;
      }

      /** Site tour already claimed — companion keys are local-only for Day 2+. */
      if (result.error === "already_claimed") {
        removePendingSync(item.taskId);
        return;
      }

      lastError = result.error;
      stillPendingTaskId = item.taskId;
      const nextAttempts = item.attempts + 1;
      if (nextAttempts >= MAX_BACKGROUND_ATTEMPTS) {
        return;
      }
      writePendingSyncs(
        readPendingSyncs().map((row) =>
          row.taskId === item.taskId
            ? { ...row, attempts: nextAttempts, updatedAt: Date.now() }
            : row
        )
      );
    })
  );

  const remaining = readPendingSyncs();
  return {
    stillPendingTaskId: remaining[0]?.taskId ?? stillPendingTaskId,
    lastError,
  };
}

let retryListenersInstalled = false;

/** Install one-time online/focus hooks to flush queued onboarding syncs. */
export function ensureOnboardingProgressSyncRetryListeners(): void {
  if (!canUseStorage() || retryListenersInstalled) return;
  retryListenersInstalled = true;

  const tryFlush = () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    if (isOnboardingSiteTourClaimedLocally()) {
      clearPendingOnboardingProgressSyncs();
      return;
    }
    void flushPendingOnboardingProgressSyncs();
  };

  window.addEventListener("online", tryFlush);
  window.addEventListener("focus", tryFlush);
}
