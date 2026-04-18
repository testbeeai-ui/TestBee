"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { getClientApiAuthHeaders } from "@/lib/clientApiAuth";
import { localDayBoundsIso } from "@/lib/dashboardDayActivity";
import type { DailyChecklistApiResponse } from "@/lib/dailyChecklistState";
import { EDUBLAST_STUDY_DAYS_REFRESH } from "@/lib/studyDayBumpEvents";
import { GyanFeedFocusTimer, useGyanDoubtsPendingFocusMs } from "@/components/doubts/GyanDoubtsFocusTracker";
import { Bookmark, CheckCircle2, Clock, ListChecks, Loader2, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const FIVE_MIN_MS = 5 * 60 * 1000;
/** Same subject scope as home dashboard checklist GET. */
const CHECKLIST_SUBJECTS_PARAM = "physics,chemistry,math,biology";
const POLL_MS = 12_000;

type RowProps = {
  done: boolean;
  icon: ReactNode;
  title: string;
  detail: string;
  end?: ReactNode;
};

function TrackerRow({ done, icon, title, detail, end }: RowProps) {
  return (
    <div className="flex items-start justify-between gap-2 rounded-xl border border-border/60 bg-background/40 px-2.5 py-2">
      <div className="flex min-w-0 flex-1 gap-2.5">
        <div className={cn("mt-0.5 shrink-0", done ? "text-emerald-500" : "text-muted-foreground")}>{icon}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            {done ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
            ) : null}
            <p
              className={cn(
                "min-w-0 text-xs font-semibold leading-tight",
                done ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"
              )}
            >
              {title}
            </p>
          </div>
          <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{detail}</p>
        </div>
      </div>
      {end ? <div className="shrink-0 pt-0.5">{end}</div> : null}
    </div>
  );
}

/**
 * Viewport-fixed left rail (same interaction model as Lessons “Progress”) + panel for
 * home checklist (c) on Gyan++: feed time, saves, community.
 */
export function GyanDailyChecklistTracker() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<DailyChecklistApiResponse | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const committedRef = useRef(false);

  const load = useCallback(async () => {
    if (!user?.id) {
      committedRef.current = false;
      setData(null);
      setStatus("idle");
      return;
    }
    const silent = committedRef.current;
    if (!silent) setStatus("loading");
    try {
      const { today, dayStart, dayEnd } = localDayBoundsIso();
      const headers = await getClientApiAuthHeaders();
      const q = new URLSearchParams({
        today,
        dayStart,
        dayEnd,
        subjects: CHECKLIST_SUBJECTS_PARAM,
      });
      const res = await fetch(`/api/user/daily-checklist?${q.toString()}`, { headers });
      if (!res.ok) {
        if (!silent) setStatus("error");
        return;
      }
      const json = (await res.json()) as DailyChecklistApiResponse;
      setData(json);
      committedRef.current = true;
      setStatus("ready");
    } catch {
      if (!silent) setStatus("error");
    }
  }, [user?.id]);

  useEffect(() => {
    committedRef.current = false;
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [load]);

  useEffect(() => {
    const onBump = () => void load();
    window.addEventListener(EDUBLAST_STUDY_DAYS_REFRESH, onBump);
    return () => window.removeEventListener(EDUBLAST_STUDY_DAYS_REFRESH, onBump);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const focusMs = data?.gyanPlusProgress.focusMs ?? 0;
  const saves = data?.gyanPlusProgress.savesToday ?? 0;
  const community = data?.gyanPlusProgress.communityActionsToday ?? 0;
  const pendingFocus = useGyanDoubtsPendingFocusMs();
  const liveFocusMs = Math.min(FIVE_MIN_MS, focusMs + pendingFocus);

  const timeDone = Boolean(data?.gyanPlusDone) || liveFocusMs >= FIVE_MIN_MS;
  const savesDone = saves >= 1;
  const communityDone = community >= 1;

  const timePct = useMemo(() => Math.min(100, Math.round((100 * liveFocusMs) / FIVE_MIN_MS)), [liveFocusMs]);

  const doneCount = (timeDone ? 1 : 0) + (savesDone ? 1 : 0) + (communityDone ? 1 : 0);

  if (!user?.id) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "fixed z-[44] left-0 top-[max(7rem,28vh)] flex h-[4.25rem] w-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-r-2xl border-y border-r border-emerald-500/45 bg-gradient-to-b from-emerald-600 to-emerald-700 text-white shadow-lg shadow-emerald-950/25 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          open ? "from-emerald-500 to-emerald-600 ring-2 ring-white/30" : "hover:from-emerald-500 hover:to-emerald-600"
        )}
        aria-label={open ? "Close Gyan++ daily checklist" : "Open Gyan++ daily checklist"}
        aria-expanded={open}
      >
        <ListChecks className="h-5 w-5 shrink-0" aria-hidden />
        <span className="text-[8px] font-extrabold uppercase tracking-tight leading-none text-center px-0.5">
          Daily
        </span>
        <span className="text-[8px] font-extrabold uppercase tracking-tight leading-none text-center px-0.5 -mt-0.5">
          Gyan
        </span>
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close checklist backdrop"
            className="fixed inset-0 z-[47] bg-black/30 backdrop-blur-[1px]"
            onClick={() => setOpen(false)}
          />
          <div
            className="fixed z-[48] left-[4.15rem] top-[max(7rem,28vh)] w-[min(84vw,24rem)] max-h-[68vh] overflow-hidden rounded-2xl border border-emerald-500/35 bg-gradient-to-b from-background via-background to-emerald-950/20 font-sans shadow-2xl shadow-emerald-950/35"
            role="dialog"
            aria-modal="true"
            aria-label="Gyan++ daily checklist"
          >
            <div className="pointer-events-none absolute -left-1.5 top-7 h-3 w-3 rotate-45 border-l border-t border-emerald-500/40 bg-background/95" />
            <div className="border-b border-border/80 px-4 pt-4 pb-3 text-left">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                    <ListChecks className="h-3.5 w-3.5 shrink-0" />
                    Today on Gyan++
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Home checklist (c): {doneCount}/3 done here — finish all three to tick it on your dashboard.
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Close checklist"
                  className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background/60 text-muted-foreground hover:text-foreground"
                  onClick={() => setOpen(false)}
                >
                  ×
                </button>
              </div>
              {data?.gyanPlusDone ? (
                <p className="mt-2 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">All set for today.</p>
              ) : null}
            </div>

            <div className="max-h-[52vh] overflow-y-auto px-4 py-3.5">
              {status === "loading" && !data ? (
                <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading progress…
                </div>
              ) : status === "error" && !data ? (
                <p className="text-xs text-rose-300 py-2">Could not load checklist. Try Refresh or reload the page.</p>
              ) : (
                <div className="space-y-2">
                  <TrackerRow
                    done={timeDone}
                    icon={<Clock className="h-4 w-4" />}
                    title={timeDone ? "Feed time — goal met" : "Stay on this feed (tab visible)"}
                    detail={
                      timeDone
                        ? "At least 5 minutes counted toward today."
                        : "Timer runs while Gyan++ is open and this tab is visible; progress saves to your dashboard automatically."
                    }
                    end={<GyanFeedFocusTimer serverMs={focusMs} goalMs={FIVE_MIN_MS} />}
                  />
                  {!timeDone ? (
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-emerald-500/80 transition-all" style={{ width: `${timePct}%` }} />
                    </div>
                  ) : null}

                  <TrackerRow
                    done={savesDone}
                    icon={<Bookmark className="h-4 w-4" />}
                    title={savesDone ? "Saved for revision" : "Save 1 doubt for revision"}
                    detail={
                      savesDone
                        ? "You saved at least one post today."
                        : `${saves} / 1 · bookmark a card in the feed (icon under each question)`
                    }
                  />

                  <TrackerRow
                    done={communityDone}
                    icon={<Users className="h-4 w-4" />}
                    title={communityDone ? "Community action" : "Engage with someone else’s post"}
                    detail={
                      communityDone
                        ? "You upvoted, downvoted, or commented on another learner’s doubt or answer today."
                        : `${community} / 1 · vote or comment on a thread that isn’t yours (or answer someone else’s question)`
                    }
                  />
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/50 pt-3 text-[11px]">
                <button type="button" className="font-semibold text-primary hover:underline" onClick={() => void load()}>
                  Refresh
                </button>
                <span className="text-muted-foreground">·</span>
                <Link href="/home" className="font-semibold text-primary hover:underline" onClick={() => setOpen(false)}>
                  Full daily checklist
                </Link>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
