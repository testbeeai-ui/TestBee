"use client";

import { useEffect, useState } from "react";

const TICK_MS = 60_000;

/**
 * Local wall clock for revision recall (tomorrow @ 9:00 AM is local time).
 * Ticks every minute and on tab focus so due cards promote without a full reload.
 */
export function useRecallNowMs(): number {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const tick = () => setNowMs(Date.now());
    const intervalId = window.setInterval(tick, TICK_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return nowMs;
}
