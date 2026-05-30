"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type SyncState = {
  /** serverNowMs - localNowMs at the moment of sync */
  offsetMs: number;
  syncedAtMs: number;
};

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

/**
 * UTC-ish clock without trusting local wall time.
 * We still tick using local time, but we anchor it to server time and keep an offset.
 *
 * IMPORTANT: to avoid whole-page rerenders every second, only call this hook in leaf components
 * (e.g. countdown text), not on the full dashboard.
 */
export function useSyncedUtcNowMs(opts?: { tickMs?: number }) {
  const tickMs = typeof opts?.tickMs === "number" && opts.tickMs > 0 ? opts.tickMs : 1000;
  const syncRef = useRef<SyncState>({ offsetMs: 0, syncedAtMs: Date.now() });
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    const doSync = async () => {
      const localBefore = Date.now();
      const serverNow = await fetchServerNowMs();
      const localAfter = Date.now();
      if (cancelled) return;
      if (serverNow == null) return;
      // Best-effort midpoint correction for network latency.
      const localMid = Math.round((localBefore + localAfter) / 2);
      syncRef.current = { offsetMs: serverNow - localMid, syncedAtMs: localAfter };
      setNowMs(localAfter + syncRef.current.offsetMs);
    };

    void doSync();
    const syncTimer = window.setInterval(doSync, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(syncTimer);
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
