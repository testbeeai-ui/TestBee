"use client";

import { ExternalLink } from "lucide-react";
import { useMemo } from "react";
import { useSyncedUtcNowMs } from "@/hooks/useSyncedUtcNow";
import type { TeacherPortalMeetSession } from "@/lib/teacherPortal/types";
import {
  evaluateSessionTemporalState,
  isActiveMeetState,
  type SessionTemporalState,
} from "@/lib/time/sessionTemporalState";

function pad2(n: number): string {
  return String(Math.max(0, Math.floor(n))).padStart(2, "0");
}

function formatCountdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h >= 1) return `${h}h ${m}m`;
  if (m >= 1) return `${m}m ${pad2(sec)}s`;
  return `${sec}s`;
}

function labelForState(state: SessionTemporalState) {
  if (state === "IDLE") return { title: "Scheduled", tone: "text-slate-300" };
  if (state === "COUNTDOWN") return { title: "Starts in", tone: "text-emerald-200" };
  if (state === "PRE_JOIN") return { title: "Join early", tone: "text-sky-200" };
  if (state === "LIVE") return { title: "In progress", tone: "text-rose-200" };
  if (state === "GRACE_PERIOD") return { title: "Wrapping up", tone: "text-amber-200" };
  return { title: "Completed", tone: "text-slate-500" };
}

export default function MeetSessionsStack({
  sessions,
  fallbackLabel,
}: {
  sessions: TeacherPortalMeetSession[] | null | undefined;
  fallbackLabel: string;
}) {
  const { nowMs } = useSyncedUtcNowMs({ tickMs: 1000 });

  const evaluated = useMemo(() => {
    const list = (sessions ?? [])
      .map((s) => {
        const startMs = Date.parse(s.scheduledAt);
        if (!Number.isFinite(startMs)) return null;
        const ev = evaluateSessionTemporalState({
          nowMs,
          startMs,
          durationMinutes: s.durationMinutes,
        });
        return { session: s, ev };
      })
      .filter(
        (x): x is { session: TeacherPortalMeetSession; ev: ReturnType<typeof evaluateSessionTemporalState> } =>
          Boolean(x)
      );

    // Render array of active states; keep multiple when overlapping (COUNTDOWN/PRE_JOIN/LIVE/GRACE_PERIOD)
    const active = list.filter((x) => isActiveMeetState(x.ev.state));

    // Sorting protocol: LIVE first, then GRACE, then PRE_JOIN, then COUNTDOWN; within each, closer start/end first
    const rank: Record<SessionTemporalState, number> = {
      LIVE: 0,
      GRACE_PERIOD: 1,
      PRE_JOIN: 2,
      COUNTDOWN: 3,
      IDLE: 4,
      COMPLETED: 5,
    };

    active.sort((a, b) => {
      const ra = rank[a.ev.state];
      const rb = rank[b.ev.state];
      if (ra !== rb) return ra - rb;
      // For LIVE/GRACE: sooner end first; for upcoming: sooner start first
      if (a.ev.state === "LIVE" || a.ev.state === "GRACE_PERIOD") return a.ev.endMs - b.ev.endMs;
      return a.ev.startMs - b.ev.startMs;
    });

    return { list, active };
  }, [sessions, nowMs]);

  if (evaluated.active.length === 0) {
    // Show the next scheduled session time without countdown/join when in IDLE for all
    const nextIdle = evaluated.list
      .filter((x) => x.ev.state === "IDLE")
      .sort((a, b) => a.ev.startMs - b.ev.startMs)[0];
    if (!nextIdle) return <span className="truncate">{fallbackLabel}</span>;
    const t = new Date(nextIdle.ev.startMs);
    const timeLabel = t.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    const scope = nextIdle.session.scopeLabel ? ` · ${nextIdle.session.scopeLabel}` : "";
    return (
      <span className="truncate">
        <span className="font-semibold text-slate-300">Scheduled</span>{" "}
        <span className="text-slate-400">for {timeLabel}</span>
        <span className="text-slate-500">{scope}</span>
      </span>
    );
  }

  return (
    <div className="flex w-full flex-col gap-1.5">
      {evaluated.active.slice(0, 2).map(({ session, ev }) => {
        const meta = labelForState(ev.state);
        const scope = session.scopeLabel ?? (session.sectionName ? `Only ${session.sectionName}` : null);
        const subtitle =
          ev.state === "COUNTDOWN"
            ? formatCountdown(ev.msToStart)
            : ev.state === "PRE_JOIN"
              ? formatCountdown(ev.msToStart)
              : ev.state === "LIVE"
                ? formatCountdown(ev.msToEnd)
                : ev.state === "GRACE_PERIOD"
                  ? formatCountdown(ev.visibleUntilMs - ev.nowMs)
                  : "";

        const canJoin = ev.state === "PRE_JOIN" || ev.state === "LIVE" || ev.state === "GRACE_PERIOD";

        return (
          <div key={session.id} className="flex items-center justify-between gap-2">
            <div className="min-w-0 text-xs">
              <span className={`font-semibold ${meta.tone}`}>{meta.title}</span>
              {subtitle ? <span className="ml-2 text-slate-400">{subtitle}</span> : null}
              {scope ? (
                <span className="ml-2 inline-flex rounded bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                  {scope}
                </span>
              ) : null}
            </div>

            {session.meetLink ? (
              <a
                href={session.meetLink}
                target="_blank"
                rel="noreferrer"
                aria-disabled={!canJoin}
                className={[
                  "shrink-0 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold",
                  canJoin
                    ? "border-sky-500/30 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20"
                    : "border-white/10 bg-white/[0.03] text-slate-400 pointer-events-none",
                ].join(" ")}
              >
                Join <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : null}
          </div>
        );
      })}
      {evaluated.active.length > 2 ? (
        <div className="text-[10px] text-slate-500">+{evaluated.active.length - 2} more</div>
      ) : null}
    </div>
  );
}

