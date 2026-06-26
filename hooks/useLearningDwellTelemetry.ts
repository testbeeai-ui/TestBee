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
/** Client-side floor between routine dwell flushes (panel switch / hide bypass). */
const MIN_DWELL_FLUSH_GAP_MS = 55_000;
/** Client-side floor between routine presence pings (panel switch / open bypass). */
const MIN_PRESENCE_PING_GAP_MS = 85_000;

type PanelTab = "instacue" | "quiz" | "numerals" | "concepts";

let dwellFlushInFlight = false;
let lastDwellFlushAt = 0;
let presencePingInFlight = false;
let lastPresencePingAt = 0;

function scopeKey(scope: LearningDwellScope | null): string {
  if (!scope) return "";
  return [
    scope.board,
    scope.subject,
    scope.classLevel,
    scope.topic,
    scope.subtopicName,
    scope.level,
  ].join("|");
}

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
  const enabledRef = useRef(opts.enabled);
  scopeRef.current = opts.scope;
  panelRef.current = opts.panelTab;
  bitsIdxRef.current = opts.bitsQuestionIndex;
  enabledRef.current = opts.enabled && Boolean(opts.scope);

  const queueRef = useRef<LearningDwellClientEvent[]>([]);
  const lastTickRef = useRef<number>(Date.now());
  const sessionIdRef = useRef<string>("");
  const flushRef = useRef<(force?: boolean) => Promise<void>>(async () => {});
  const enqueueRef = useRef<(panelTab: PanelTab, deltaMs: number) => void>(() => {});
  const pingRef = useRef<(panelTab: PanelTab, force?: boolean) => Promise<void>>(async () => {});

  const activeScopeKey = opts.enabled && opts.scope ? scopeKey(opts.scope) : "";

  useEffect(() => {
    if (!activeScopeKey) return;

    sessionIdRef.current =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `dwell-${Date.now()}`;
    lastTickRef.current = Date.now();
    queueRef.current = [];

    const pingBuddyPresence = async (panelTab: PanelTab, force = false) => {
      const sc = scopeRef.current;
      if (!sc || !enabledRef.current) return;
      const now = Date.now();
      if (!force && now - lastPresencePingAt < MIN_PRESENCE_PING_GAP_MS) return;
      if (presencePingInFlight) return;
      presencePingInFlight = true;
      const { session } = await safeGetSession();
      const token = session?.access_token;
      if (!token) {
        presencePingInFlight = false;
        return;
      }
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
        if (res.ok) lastPresencePingAt = Date.now();
        else if (process.env.NODE_ENV === "development") {
          const text = await res.text().catch(() => "");
          console.warn("[learning-presence]", res.status, text.slice(0, 200));
        }
      } catch (err) {
        if (process.env.NODE_ENV === "development") {
          console.warn("[learning-presence]", err);
        }
      } finally {
        presencePingInFlight = false;
      }
    };
    pingRef.current = pingBuddyPresence;

    const enqueue = (panelTab: PanelTab, deltaMs: number) => {
      const d = clampDeltaMs(deltaMs);
      if (d <= 0) return;
      const sc = scopeRef.current;
      if (!sc || !enabledRef.current) return;
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

    const flush = async (force = false) => {
      if (queueRef.current.length === 0) return;
      const now = Date.now();
      if (!force && now - lastDwellFlushAt < MIN_DWELL_FLUSH_GAP_MS) return;
      if (dwellFlushInFlight) return;
      dwellFlushInFlight = true;
      const batch = queueRef.current.splice(0, 25);
      const { session } = await safeGetSession();
      const token = session?.access_token;
      if (!token) {
        queueRef.current.unshift(...batch);
        dwellFlushInFlight = false;
        return;
      }
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
        if (res.ok) {
          lastDwellFlushAt = Date.now();
        } else {
          queueRef.current.unshift(...batch);
          if (process.env.NODE_ENV === "development") {
            const text = await res.text().catch(() => "");
            console.warn("[learning-dwell]", res.status, text.slice(0, 200));
          }
        }
      } catch (err) {
        queueRef.current.unshift(...batch);
        if (process.env.NODE_ENV === "development") {
          console.warn("[learning-dwell]", err);
        }
      } finally {
        dwellFlushInFlight = false;
      }
    };
    flushRef.current = flush;

    void pingBuddyPresence(panelRef.current, true);
    enqueue(panelRef.current, PRESENCE_PING_MS);
    void flush(true);

    const presenceInterval = window.setInterval(() => {
      if (document.visibilityState !== "visible" || !enabledRef.current) return;
      void pingBuddyPresence(panelRef.current, false);
    }, PRESENCE_REFRESH_MS);

    const tick = () => {
      if (document.visibilityState !== "visible" || !enabledRef.current) return;
      const now = Date.now();
      const raw = now - lastTickRef.current;
      lastTickRef.current = now;
      enqueue(panelRef.current, raw);
      void flush(false);
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        const now = Date.now();
        const raw = now - lastTickRef.current;
        lastTickRef.current = now;
        enqueue(panelRef.current, raw);
        void flush(true);
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
      const raw = now - lastTickRef.current;
      if (raw >= 500) {
        enqueue(panelRef.current, raw);
        void flush(true);
      }
    };
  }, [activeScopeKey]);

  useEffect(() => {
    if (!enabledRef.current || !scopeRef.current) {
      panelRef.current = opts.panelTab;
      return;
    }
    if (panelRef.current === opts.panelTab) return;
    const now = Date.now();
    const raw = now - lastTickRef.current;
    lastTickRef.current = now;
    enqueueRef.current(panelRef.current, raw);
    panelRef.current = opts.panelTab;
    void flushRef.current(true);
    void pingRef.current(opts.panelTab, true);
  }, [opts.panelTab]);
}
