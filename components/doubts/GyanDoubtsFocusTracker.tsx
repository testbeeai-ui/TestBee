"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { getClientApiAuthHeaders } from "@/lib/clientApiAuth";
import { localDayBoundsIso } from "@/lib/dashboardDayActivity";
import { dispatchStudyDayBumped } from "@/lib/studyDayBumpEvents";
import { cn } from "@/lib/utils";

const FLUSH_EVERY_MS = 25_000;
const TICK_MS = 1000;

/** Milliseconds accumulated this session on Gyan++ not yet PATCHed to the server (for live UI). */
const GyanPendingFocusContext = createContext(0);

export function useGyanDoubtsPendingFocusMs(): number {
  return useContext(GyanPendingFocusContext);
}

function formatMmSs(ms: number): string {
  const capped = Math.max(0, Math.min(ms, 99 * 60_000 + 59_999));
  const s = Math.floor(capped / 1000);
  const m = Math.floor(s / 60);
  const rs = s % 60;
  return `${String(m).padStart(2, "0")}:${String(rs).padStart(2, "0")}`;
}

/**
 * Accumulates focused time while the user stays on Gyan++ (/doubts) with the tab visible,
 * and PATCHes `profiles.daily_checklist_state` for the dashboard checklist (5 min rule).
 * Exposes pending ms via context so the checklist panel can show a live timer.
 */
export function GyanDoubtsFocusTracker({ children }: { children?: ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const onGyan = pathname === "/doubts" || pathname.startsWith("/doubts/");
  const [pendingDisplay, setPendingDisplay] = useState(0);

  const pendingRef = useRef(0);
  const lastTickRef = useRef(0);
  const lastFlushRef = useRef(0);

  useEffect(() => {
    if (!user?.id || !onGyan) {
      lastTickRef.current = 0;
      pendingRef.current = 0;
      setPendingDisplay(0);
      return;
    }
    lastTickRef.current = Date.now();
    lastFlushRef.current = Date.now();

    const flush = async () => {
      const chunk = pendingRef.current;
      if (chunk < 1000) return;
      pendingRef.current = 0;
      const { today } = localDayBoundsIso();
      try {
        const headers = await getClientApiAuthHeaders();
        const res = await fetch("/api/user/daily-checklist", {
          method: "PATCH",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ action: "doubts_focus", today, addMs: chunk }),
        });
        if (!res.ok) pendingRef.current += chunk;
        else dispatchStudyDayBumped({ day: today, deltaMs: chunk });
      } catch {
        pendingRef.current += chunk;
      }
      setPendingDisplay(pendingRef.current);
    };

    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      const prev = lastTickRef.current || now;
      const dt = Math.min(120_000, Math.max(0, now - prev));
      lastTickRef.current = now;
      pendingRef.current += dt;
      setPendingDisplay(pendingRef.current);
      if (now - lastFlushRef.current >= FLUSH_EVERY_MS) {
        lastFlushRef.current = now;
        void flush();
      }
    }, TICK_MS);

    const onVis = () => {
      if (document.visibilityState === "hidden") void flush();
      else lastTickRef.current = Date.now();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.clearInterval(id);
      void flush();
    };
  }, [user?.id, onGyan]);

  return <GyanPendingFocusContext.Provider value={pendingDisplay}>{children ?? null}</GyanPendingFocusContext.Provider>;
}

/** Live MM:SS for feed focus (server snapshot + pending session ms). */
export function GyanFeedFocusTimer({ serverMs, goalMs }: { serverMs: number; goalMs: number }) {
  const pending = useGyanDoubtsPendingFocusMs();
  const live = Math.min(goalMs, serverMs + pending);
  const done = live >= goalMs;
  return (
    <div className="text-right tabular-nums" aria-live="polite">
      <p className={cn("font-mono text-base font-bold leading-none", done ? "text-emerald-500" : "text-foreground")}>
        {formatMmSs(live)}
      </p>
      <p className="mt-0.5 text-[10px] font-medium text-muted-foreground">/ {formatMmSs(goalMs)}</p>
    </div>
  );
}
