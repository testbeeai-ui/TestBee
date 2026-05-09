"use client";

import { useEffect, useRef } from "react";
import {
  clampDeltaMs,
  mapTopicPanelTabToDwellPanel,
  type LearningDwellClientEvent,
  type LearningDwellScope,
} from "@/lib/learningDwellTelemetry";
import { safeGetSession } from "@/lib/safeSession";

/** Heartbeat interval; panel switches may be attributed up to this lag. */
const TICK_MS = 15_000;

type PanelTab = "instacue" | "quiz" | "numerals" | "concepts";

/**
 * Sends coarse dwell samples while the subtopic tab is visible (heartbeat + visibility flush).
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
  panelRef.current = opts.panelTab;
  bitsIdxRef.current = opts.bitsQuestionIndex;

  useEffect(() => {
    if (!opts.enabled || !opts.scope) return;

    const queue: LearningDwellClientEvent[] = [];
    let lastTick = Date.now();
    const sessionId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `dwell-${Date.now()}`;

    const enqueue = (panelTab: PanelTab, deltaMs: number) => {
      const d = clampDeltaMs(deltaMs);
      if (d <= 0) return;
      const sc = scopeRef.current;
      if (!sc) return;
      const panel = mapTopicPanelTabToDwellPanel(panelTab);
      const bitsIdx = panel === "bits" ? bitsIdxRef.current : null;
      queue.push({
        deltaMs: d,
        panel,
        scope: sc,
        bitsQuestionIndex: bitsIdx,
        occurredAt: new Date().toISOString(),
      });
    };

    const flush = async () => {
      if (queue.length === 0) return;
      const batch = queue.splice(0, 25);
      const { session } = await safeGetSession();
      const token = session?.access_token;
      if (!token) return;
      try {
        await fetch("/api/user/learning-dwell", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ events: batch, clientSessionId: sessionId }),
          keepalive: true,
        });
      } catch {
        /* non-fatal */
      }
    };

    const tick = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      const raw = now - lastTick;
      lastTick = now;
      enqueue(panelRef.current, raw);
      void flush();
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        const now = Date.now();
        const raw = now - lastTick;
        lastTick = now;
        enqueue(panelRef.current, raw);
        void flush();
      } else {
        lastTick = Date.now();
      }
    };

    const interval = window.setInterval(tick, TICK_MS);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      const now = Date.now();
      enqueue(panelRef.current, now - lastTick);
      void flush();
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
}
