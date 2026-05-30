import {
  syncDailyStreakTaskToServer,
  resetDailyStreakDayOnServer,
  fetchOnboardingRewardState,
} from "@/lib/subscription/onboardingRewardApi";
import type { DailyStreakServerState } from "@/lib/onboarding/dailyStreakProgress";
import { DAILY_TASK_IDS } from "@/lib/onboarding/dailyStreakClient";
import {
  dailyChecklistStorageKey,
  dailyCbseMcqDoneDateKey,
  getLocalCalendarDateIso,
} from "@/lib/onboarding/dailyChecklistTaskStorage";

const PENDING_SYNC_KEY = "edublast.daily_streak_pending_sync_v1";
const MAX_BACKGROUND_ATTEMPTS = 8;

export type PendingDailyStreakSync = {
  trialDayNumber: number;
  taskId: string;
  userId: string;
  attempts: number;
  updatedAt: number;
};

function canUseStorage(): boolean {
  return typeof window !== "undefined";
}

function readPendingSyncs(): PendingDailyStreakSync[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(PENDING_SYNC_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is PendingDailyStreakSync =>
        Boolean(item) &&
        typeof item === "object" &&
        typeof (item as PendingDailyStreakSync).taskId === "string" &&
        typeof (item as PendingDailyStreakSync).userId === "string" &&
        Number.isFinite((item as PendingDailyStreakSync).trialDayNumber)
    );
  } catch {
    return [];
  }
}

function writePendingSyncs(items: PendingDailyStreakSync[]): void {
  if (!canUseStorage()) return;
  if (items.length === 0) {
    window.localStorage.removeItem(PENDING_SYNC_KEY);
    return;
  }
  window.localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(items));
}

function pendingKey(trialDayNumber: number, taskId: string): string {
  return `${trialDayNumber}:${taskId}`;
}

function isT3ValidForToday(
  row: DailyStreakServerState[string] | undefined,
  nowMs: number
): boolean {
  const completedAt = row?.tasks?.t3?.completed_at;
  if (!completedAt) return false;
  const parsed = Date.parse(completedAt);
  if (!Number.isFinite(parsed)) return false;
  return getLocalCalendarDateIso(parsed) === getLocalCalendarDateIso(nowMs);
}

/** Task ids credited on the server for one streak day (partial or complete). */
export function getDailyStreakDayTaskIdsFromServer(
  serverStreak: DailyStreakServerState | undefined,
  trialDayNumber: number,
  nowMs?: number
): string[] {
  const row = serverStreak?.[String(trialDayNumber)];
  const raw = row?.task_ids;
  if (!Array.isArray(raw)) return [];
  const allowed = new Set<string>(DAILY_TASK_IDS);
  return raw.filter((id): id is string => {
    if (typeof id !== "string" || !allowed.has(id)) return false;
    if (id === "t3" && nowMs != null) return isT3ValidForToday(row, nowMs);
    return true;
  });
}

/** Merge server + local completed ids; persist union locally when server has more. */
export function mergeDailyChecklistCompleted(
  userId: string,
  trialDayNumber: number,
  localIds: string[],
  serverStreak?: DailyStreakServerState,
  nowMs?: number
): string[] {
  const serverIds = getDailyStreakDayTaskIdsFromServer(serverStreak, trialDayNumber, nowMs);
  const merged = Array.from(new Set([...localIds, ...serverIds])).filter((id) =>
    (DAILY_TASK_IDS as readonly string[]).includes(id)
  );

  if (canUseStorage() && merged.length > localIds.length) {
    window.localStorage.setItem(
      dailyChecklistStorageKey(userId, trialDayNumber),
      JSON.stringify(merged)
    );
  }

  return merged;
}

export function enqueueDailyStreakTaskSync(
  userId: string,
  trialDayNumber: number,
  taskId: string
): void {
  if (!canUseStorage() || !userId || !taskId) return;
  const items = readPendingSyncs();
  const key = pendingKey(trialDayNumber, taskId);
  const existing = items.find(
    (item) => pendingKey(item.trialDayNumber, item.taskId) === key && item.userId === userId
  );
  if (existing) {
    existing.updatedAt = Date.now();
  } else {
    items.push({
      userId,
      trialDayNumber,
      taskId,
      attempts: 0,
      updatedAt: Date.now(),
    });
  }
  writePendingSyncs(items);
}

function removePendingSync(trialDayNumber: number, taskId: string, userId: string): void {
  writePendingSyncs(
    readPendingSyncs().filter(
      (item) =>
        !(
          item.userId === userId &&
          item.trialDayNumber === trialDayNumber &&
          item.taskId === taskId
        )
    )
  );
}

export function hasPendingDailyStreakSyncs(): boolean {
  return readPendingSyncs().length > 0;
}

export async function flushPendingDailyStreakSyncs(): Promise<{
  stillPending: PendingDailyStreakSync | null;
  lastError?: string;
}> {
  if (!canUseStorage()) return { stillPending: null };
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    const pending = readPendingSyncs();
    return { stillPending: pending[0] ?? null, lastError: "offline" };
  }

  const items = readPendingSyncs();
  if (items.length === 0) return { stillPending: null };

  let stillPending: PendingDailyStreakSync | null = null;
  let lastError: string | undefined;

  for (const item of items) {
    const result = await syncDailyStreakTaskToServer(item.trialDayNumber, item.taskId);
    if (result.ok) {
      removePendingSync(item.trialDayNumber, item.taskId, item.userId);
      continue;
    }

    lastError = result.error;
    stillPending = item;
    const nextAttempts = item.attempts + 1;
    if (nextAttempts >= MAX_BACKGROUND_ATTEMPTS) continue;

    writePendingSyncs(
      readPendingSyncs().map((row) =>
        row.userId === item.userId &&
        row.trialDayNumber === item.trialDayNumber &&
        row.taskId === item.taskId
          ? { ...row, attempts: nextAttempts, updatedAt: Date.now() }
          : row
      )
    );
  }

  const remaining = readPendingSyncs();
  return {
    stillPending: remaining[0] ?? stillPending,
    lastError,
  };
}

let retryListenersInstalled = false;

export function ensureDailyStreakSyncRetryListeners(): void {
  if (!canUseStorage() || retryListenersInstalled) return;
  retryListenersInstalled = true;

  const tryFlush = () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    void flushPendingDailyStreakSyncs();
  };

  window.addEventListener("online", tryFlush);
  window.addEventListener("focus", tryFlush);
}

/** Push one daily task to Supabase; queue on failure. */
export async function persistDailyStreakTaskToServer(
  userId: string,
  trialDayNumber: number,
  taskId: string
): Promise<{ ok: boolean; error?: string }> {
  ensureDailyStreakSyncRetryListeners();

  let result = await syncDailyStreakTaskToServer(trialDayNumber, taskId);
  if (!result.ok) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    result = await syncDailyStreakTaskToServer(trialDayNumber, taskId);
  }

  if (!result.ok) {
    enqueueDailyStreakTaskSync(userId, trialDayNumber, taskId);
    return { ok: false, error: result.error };
  }

  removePendingSync(trialDayNumber, taskId, userId);
  return { ok: true };
}

/** Before 6/6 claim: flush queue, push any local-only tasks, ensure server has all six. */
export async function prepareDailyStreakClaim(
  userId: string,
  trialDayNumber: number
): Promise<{
  ready: boolean;
  missingTaskIds: string[];
  syncError?: string;
}> {
  if (!canUseStorage()) {
    return {
      ready: false,
      missingTaskIds: [...DAILY_TASK_IDS],
      syncError: "offline",
    };
  }

  await flushPendingDailyStreakSyncs();

  const localRaw = window.localStorage.getItem(dailyChecklistStorageKey(userId, trialDayNumber));
  let localIds: string[] = [];
  if (localRaw) {
    try {
      const parsed = JSON.parse(localRaw);
      if (Array.isArray(parsed)) {
        localIds = parsed.filter((id): id is string => typeof id === "string");
      }
    } catch {
      /* ignore */
    }
  }

  let state = await fetchOnboardingRewardState();
  const nowMs = Date.now();
  let serverIds = getDailyStreakDayTaskIdsFromServer(
    state.dailyStreak as DailyStreakServerState | undefined,
    trialDayNumber,
    nowMs
  );

  const missingOnServer = DAILY_TASK_IDS.filter((id) => !serverIds.includes(id));
  const localOnly = missingOnServer.filter((id) => localIds.includes(id));

  if (localOnly.length > 0) {
    await Promise.all(
      localOnly.map((taskId) => persistDailyStreakTaskToServer(userId, trialDayNumber, taskId))
    );
    await flushPendingDailyStreakSyncs();
    state = await fetchOnboardingRewardState();
    serverIds = getDailyStreakDayTaskIdsFromServer(
      state.dailyStreak as DailyStreakServerState | undefined,
      trialDayNumber,
      nowMs
    );
  }

  if (DAILY_TASK_IDS.every((id) => serverIds.includes(id))) {
    return { ready: true, missingTaskIds: [] };
  }

  const flush = hasPendingDailyStreakSyncs()
    ? await flushPendingDailyStreakSyncs()
    : {
        stillPending: null as PendingDailyStreakSync | null,
        lastError: undefined as string | undefined,
      };

  if (flush.stillPending) {
    return {
      ready: false,
      missingTaskIds: DAILY_TASK_IDS.filter((id) => !serverIds.includes(id)),
      syncError: flush.lastError ?? "sync_pending",
    };
  }

  state = await fetchOnboardingRewardState();
  serverIds = getDailyStreakDayTaskIdsFromServer(
    state.dailyStreak as DailyStreakServerState | undefined,
    trialDayNumber,
    nowMs
  );

  const stillMissing = DAILY_TASK_IDS.filter((id) => !serverIds.includes(id));
  return {
    ready: stillMissing.length === 0,
    missingTaskIds: stillMissing,
    syncError: stillMissing.length > 0 ? "incomplete_on_server" : undefined,
  };
}

export async function resetDailyStreakDayProgress(
  userId: string,
  trialDayNumber: number
): Promise<{ ok: boolean; error?: string }> {
  if (!canUseStorage()) return { ok: false, error: "offline" };

  writePendingSyncs(
    readPendingSyncs().filter(
      (item) => !(item.userId === userId && item.trialDayNumber === trialDayNumber)
    )
  );

  const result = await resetDailyStreakDayOnServer(trialDayNumber);
  if (!result.ok) return result;

  window.localStorage.removeItem(dailyChecklistStorageKey(userId, trialDayNumber));
  window.localStorage.removeItem(dailyCbseMcqDoneDateKey(userId, trialDayNumber));
  return { ok: true };
}
