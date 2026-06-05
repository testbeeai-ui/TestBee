"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type SyncState = {
  /** serverNowMs - localNowMs at the moment of sync */
  offsetMs: number;
  syncedAtMs: number;
};

let sharedSync: SyncState = { offsetMs: 0, syncedAtMs: Date.now() };
let sharedSyncPromise: Promise<void> | null = null;
let sharedSyncIntervalId: any = null;
const sharedSyncListeners = new Set<() => void>();

async function fetchServerNowMs(): Promise<number | null> {
  try {
    const res = await fetch("/api/time", { credentials: "include" });
    if (!res.ok) return null;
    const data = (await res.json()) as { nowMs?: unknown };
    const n = Number(data.nowMs);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function notifySharedSyncListeners() {
  for (const fn of sharedSyncListeners) fn();
}

async function runSharedSync(): Promise<void> {
  const localBefore = Date.now();
  const serverNow = await fetchServerNowMs();
  const localAfter = Date.now();
  if (serverNow == null) return;
  const localMid = Math.round((localBefore + localAfter) / 2);
  sharedSync = { offsetMs: serverNow - localMid, syncedAtMs: localAfter };
  notifySharedSyncListeners();
}

function ensureSharedSyncScheduled(): void {
  if (sharedSyncPromise) return;
  sharedSyncPromise = runSharedSync().finally(() => {
    sharedSyncPromise = null;
  });
  if (sharedSyncIntervalId == null && typeof window !== "undefined") {
    sharedSyncIntervalId = window.setInterval(() => {
      void runSharedSync();
    }, 5 * 60 * 1000);
  }
}

/**
 * UTC-ish clock without trusting local wall time.
 * We still tick using local time, but we anchor it to server time and keep an offset.
 *
 * IMPORTANT: to avoid whole-page rerenders every second, only call this hook in leaf components
 * (e.g. countdown text), not on the full dashboard.
 *
 * Server sync is shared across all hook instances (one /api/time fetch per mount wave).
 */
export function useSyncedUtcNowMs(opts?: { tickMs?: number }) {
  const tickMs = typeof opts?.tickMs === "number" && opts.tickMs > 0 ? opts.tickMs : 1000;
  const [, bump] = useState(0);
  const syncRef = useRef<SyncState>(sharedSync);
  const [nowMs, setNowMs] = useState(() => Date.now() + sharedSync.offsetMs);

  useEffect(() => {
    const onSync = () => {
      syncRef.current = sharedSync;
      setNowMs(Date.now() + sharedSync.offsetMs);
      bump((n) => n + 1);
    };
    sharedSyncListeners.add(onSync);
    ensureSharedSyncScheduled();
    onSync();
    return () => {
      sharedSyncListeners.delete(onSync);
    };
  }, []);

  useEffect(() => {
    const t = window.setInterval(() => {
      const local = Date.now();
      setNowMs(local + syncRef.current.offsetMs);
    }, tickMs);
    return () => window.clearInterval(t);
  }, [tickMs]);

  return useMemo(
    () => ({
      nowMs,
      offsetMs: syncRef.current.offsetMs,
      lastSyncedAtMs: syncRef.current.syncedAtMs,
    }),
    [nowMs]
  );
}
