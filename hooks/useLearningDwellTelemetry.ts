"use client";

import { useEffect, useRef } from "react";
import {
  clampDeltaMs,
  mapTopicPanelTabToDwellPanel,
  type LearningDwellClientEvent,
  type LearningDwellScope,
} from "@/lib/dashboard/learningDwellTelemetry";
import { safeGetSession } from "@/lib/auth/safeSession";

/**
 * Heartbeat / flush interval. Dwell deltas are still bookmarked accurately at panel switches
 * and visibility changes; the heartbeat just bounds the worst-case "still on the same panel"
 * latency. Larger interval = fewer POSTs to `/api/user/learning-dwell` = less DB load on
 * MICRO compute.
 */
const FLUSH_MS = 60_000;
/** Minimum sample sent on subtopic open so buddies see activity within seconds. */
const PRESENCE_PING_MS = 1_000;
/** Client ping interval; server skips writes if subtopic/panel unchanged (see learning-presence API). */
const PRESENCE_REFRESH_MS = 90_000;

type PanelTab = "instacue" | "quiz" | "numerals" | "concepts";

/**
 * Sends coarse dwell samples while the subtopic tab is visible.
 * Captures deltas at panel transitions, visibility changes, and unmount; otherwise batches
 * into a single POST per minute to keep DB CPU and egress low.
 * Does not run on topic overview pages.
 */
export function useLearningDwellTelemetry(opts: {
  enabled: boolean;
  scope: LearningDwellScope | null;
  panelTab: PanelTab;
  bitsQuestionIndex: number | null;
}): void {
  const scopeRef = useRef(opts.scope);
  const panelRef = useRef(opts.panelTab);
  const bitsIdxRef = useRef(opts.bitsQuestionIndex);
  scopeRef.current = opts.scope;
  bitsIdxRef.current = opts.bitsQuestionIndex;

  const queueRef = useRef<LearningDwellClientEvent[]>([]);
  const lastTickRef = useRef<number>(Date.now());
  const sessionIdRef = useRef<string>("");
  const flushRef = useRef<() => Promise<void>>(async () => {});
  const enqueueRef = useRef<(panelTab: PanelTab, deltaMs: number) => void>(() => {});

  useEffect(() => {
    if (!opts.enabled || !opts.scope) return;

    const pingBuddyPresence = async (panelTab: PanelTab) => {
      const sc = scopeRef.current;
      if (!sc) return;
      const { session } = await safeGetSession();
      const token = session?.access_token;
      if (!token) return;
      const panel = mapTopicPanelTabToDwellPanel(panelTab);
      try {
        const res = await fetch("/api/user/learning-presence", {
          method: "POST",
          credentials: "same-origin",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ scope: sc, panel }),
          keepalive: true,
        });
        if (!res.ok && process.env.NODE_ENV === "development") {
          const text = await res.text().catch(() => "");
          console.warn("[learning-presence]", res.status, text.slice(0, 200));
        }
      } catch (err) {
        if (process.env.NODE_ENV === "development") {
          console.warn("[learning-presence]", err);
        }
      }
    };

    sessionIdRef.current =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `dwell-${Date.now()}`;
    lastTickRef.current = Date.now();

    const enqueue = (panelTab: PanelTab, deltaMs: number) => {
      const d = clampDeltaMs(deltaMs);
      if (d <= 0) return;
      const sc = scopeRef.current;
      if (!sc) return;
      const panel = mapTopicPanelTabToDwellPanel(panelTab);
      const bitsIdx = panel === "bits" ? bitsIdxRef.current : null;
      queueRef.current.push({
        deltaMs: d,
        panel,
        scope: sc,
        bitsQuestionIndex: bitsIdx,
        occurredAt: new Date().toISOString(),
      });
    };
    enqueueRef.current = enqueue;

    const flush = async () => {
      if (queueRef.current.length === 0) return;
      const batch = queueRef.current.splice(0, 25);
      const { session } = await safeGetSession();
      const token = session?.access_token;
      if (!token) return;
      try {
        const res = await fetch("/api/user/learning-dwell", {
          method: "POST",
          credentials: "same-origin",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ events: batch, clientSessionId: sessionIdRef.current }),
          keepalive: true,
        });
        if (!res.ok && process.env.NODE_ENV === "development") {
          const text = await res.text().catch(() => "");
          console.warn("[learning-dwell]", res.status, text.slice(0, 200));
        }
      } catch (err) {
        if (process.env.NODE_ENV === "development") {
          console.warn("[learning-dwell]", err);
        }
      }
    };
    flushRef.current = flush;

    void pingBuddyPresence(panelRef.current);
    enqueue(panelRef.current, PRESENCE_PING_MS);
    void flush();

    const presenceInterval = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void pingBuddyPresence(panelRef.current);
    }, PRESENCE_REFRESH_MS);

    const tick = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      const raw = now - lastTickRef.current;
      lastTickRef.current = now;
      enqueue(panelRef.current, raw);
      void flush();
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        const now = Date.now();
        const raw = now - lastTickRef.current;
        lastTickRef.current = now;
        enqueue(panelRef.current, raw);
        void flush();
      } else {
        lastTickRef.current = Date.now();
      }
    };

    const interval = window.setInterval(tick, FLUSH_MS);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(interval);
      window.clearInterval(presenceInterval);
      document.removeEventListener("visibilitychange", onVisibility);
      const now = Date.now();
      enqueue(panelRef.current, now - lastTickRef.current);
      void flush();
      void pingBuddyPresence(panelRef.current);
    };
  }, [
    opts.enabled,
    opts.scope?.board,
    opts.scope?.subject,
    opts.scope?.classLevel,
    opts.scope?.topic,
    opts.scope?.subtopicName,
    opts.scope?.level,
  ]);

  // Capture the prior panel's dwell at the exact moment the user switches panels.
  // Without this, a 60s heartbeat would mis-attribute everything to whichever panel
  // happens to be current at tick time.
  useEffect(() => {
    if (!opts.enabled || !opts.scope) {
      panelRef.current = opts.panelTab;
      return;
    }
    if (panelRef.current === opts.panelTab) return;
    const now = Date.now();
    const raw = now - lastTickRef.current;
    lastTickRef.current = now;
    enqueueRef.current(panelRef.current, raw);
    panelRef.current = opts.panelTab;
    void (async () => {
      const sc = scopeRef.current;
      if (!sc) return;
      const { session } = await safeGetSession();
      const token = session?.access_token;
      if (!token) return;
      const panel = mapTopicPanelTabToDwellPanel(opts.panelTab);
      try {
        await fetch("/api/user/learning-presence", {
          method: "POST",
          credentials: "same-origin",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ scope: sc, panel }),
          keepalive: true,
        });
      } catch {
        /* non-fatal */
      }
    })();
  }, [opts.panelTab, opts.enabled, opts.scope]);
}
