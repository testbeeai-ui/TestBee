"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { localDayBoundsIso } from "@/lib/dashboard/dashboardDayActivity";
import { fetchDailyChecklist } from "@/lib/dashboard/dailyChecklistClient";
import type { DailyChecklistApiResponse } from "@/lib/dashboard/dailyChecklistState";
import { EDUBLAST_GYAN_DAILY_CHECKLIST_REFRESH } from "@/lib/dashboard/studyDayBumpEvents";
import {
  GyanFeedFocusTimer,
  useGyanDoubtsPendingFocusMs,
} from "@/components/doubts/GyanDoubtsFocusTracker";
import { Bookmark, CheckCircle2, Clock, ListChecks, Loader2, Users, X } from "lucide-react";
import { startVisiblePoll } from "@/lib/telemetry/visiblePoll";
import { cn } from "@/lib/utils";

const FIVE_MIN_MS = 5 * 60 * 1000;
const CHECKLIST_SUBJECTS_PARAM = "physics,chemistry,math";
const POLL_MS = 60_000;
const REFRESH_DEBOUNCE_MS = 2_000;

type RowProps = {
  done: boolean;
  icon: ReactNode;
  title: string;
  detail: string;
  end?: ReactNode;
  progressPct?: number;
};

function TrackerRow({ done, icon, title, detail, end, progressPct }: RowProps) {
  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2.5 transition-colors",
        done
          ? "border-emerald-500/35 bg-emerald-500/[0.07]"
          : "border-white/[0.07] bg-white/[0.02]"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 gap-2.5">
          <div className={cn("mt-0.5 shrink-0", done ? "text-emerald-400" : "text-slate-400")}>
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              {done ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden />
              ) : null}
              <p
                className={cn(
                  "min-w-0 text-xs font-semibold leading-snug",
                  done ? "text-emerald-300" : "text-slate-100"
                )}
              >
                {title}
              </p>
            </div>
            <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{detail}</p>
          </div>
        </div>
        {end ? <div className="shrink-0 pt-0.5">{end}</div> : null}
      </div>
      {progressPct !== undefined && !done ? (
        <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

function ProgressSegments({
  timeDone,
  savesDone,
  communityDone,
}: {
  timeDone: boolean;
  savesDone: boolean;
  communityDone: boolean;
}) {
  return (
    <div className="flex gap-1" aria-hidden>
      {[timeDone, savesDone, communityDone].map((done, i) => (
        <div
          key={i}
          className={cn(
            "h-1 flex-1 rounded-full transition-colors",
            done ? "bg-emerald-500" : "bg-white/10"
          )}
        />
      ))}
    </div>
  );
}

type ChecklistPanelProps = {
  open: boolean;
  onClose: () => void;
  status: "idle" | "loading" | "ready" | "error";
  data: DailyChecklistApiResponse | null;
  doneCount: number;
  timeDone: boolean;
  savesDone: boolean;
  communityDone: boolean;
  focusMs: number;
  timePct: number;
  saves: number;
  community: number;
  onRefresh: () => void;
};

function GyanChecklistPanel({
  open,
  onClose,
  status,
  data,
  doneCount,
  timeDone,
  savesDone,
  communityDone,
  focusMs,
  timePct,
  saves,
  community,
  onRefresh,
}: ChecklistPanelProps) {
  if (!open) return null;

  const allDone = doneCount === 3;

  return (
    <>
      <button
        type="button"
        aria-label="Close checklist backdrop"
        className="fixed inset-0 z-[55] bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        className="fixed z-[60] left-1/2 top-1/2 flex w-[min(92vw,21.5rem)] max-h-[min(88vh,34rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0a0f1a] font-sans shadow-2xl shadow-black/50"
        role="dialog"
        aria-modal="true"
        aria-label="Gyan++ daily checklist"
      >
        <div className="shrink-0 border-b border-white/[0.06] px-4 pb-3 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-emerald-400">
                <ListChecks className="h-4 w-4 shrink-0" aria-hidden />
                Today&apos;s Gyan++ tasks
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                {allDone
                  ? "All done — your dashboard checklist is updated."
                  : `${doneCount} of 3 complete · finish all to tick your home checklist.`}
              </p>
              <div className="mt-3">
                <ProgressSegments
                  timeDone={timeDone}
                  savesDone={savesDone}
                  communityDone={communityDone}
                />
              </div>
            </div>
            <button
              type="button"
              aria-label="Close checklist"
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-white"
              onClick={onClose}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {status === "loading" && !data ? (
            <div className="flex items-center gap-2 py-6 text-xs text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading progress…
            </div>
          ) : status === "error" && !data ? (
            <p className="py-4 text-xs text-rose-400">
              Could not load checklist. Tap Refresh or reload the page.
            </p>
          ) : (
            <div className="space-y-2">
              <TrackerRow
                done={timeDone}
                icon={<Clock className="h-4 w-4" />}
                title={timeDone ? "5 minutes on Gyan++" : "Spend 5 minutes on Gyan++"}
                detail={
                  timeDone
                    ? "Feed time counted for today."
                    : "Timer runs while this page is open and visible."
                }
                end={<GyanFeedFocusTimer serverMs={focusMs} goalMs={FIVE_MIN_MS} compact />}
                progressPct={timeDone ? undefined : timePct}
              />

              <TrackerRow
                done={savesDone}
                icon={<Bookmark className="h-4 w-4" />}
                title={savesDone ? "Doubt saved" : "Save 1 doubt for revision"}
                detail={
                  savesDone
                    ? "You bookmarked a post today."
                    : `${saves} / 1 · use Save for revision on any card`
                }
              />

              <TrackerRow
                done={communityDone}
                icon={<Users className="h-4 w-4" />}
                title={communityDone ? "Community engagement" : "Engage on someone else's post"}
                detail={
                  communityDone
                    ? "You liked or replied on another learner's thread today."
                    : `${community} / 1 · like or comment on a thread`
                }
              />
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-white/[0.06] px-4 py-3 text-xs">
          <button
            type="button"
            className="font-semibold text-emerald-400/90 transition-colors hover:text-emerald-300"
            onClick={onRefresh}
          >
            Refresh
          </button>
          <Link
            href="/home"
            className="font-semibold text-slate-400 transition-colors hover:text-slate-200"
            onClick={onClose}
          >
            Open dashboard checklist →
          </Link>
        </div>
      </div>
    </>
  );
}

function useGyanChecklistData() {
  const { user } = useAuth();
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
      const q = new URLSearchParams({
        today,
        dayStart,
        dayEnd,
        subjects: CHECKLIST_SUBJECTS_PARAM,
      });
      const json = await fetchDailyChecklist(q);
      if (!json) {
        if (!silent) setStatus("error");
        return;
      }
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

  const focusMs = data?.gyanPlusProgress.focusMs ?? 0;
  const saves = data?.gyanPlusProgress.savesToday ?? 0;
  const community = data?.gyanPlusProgress.communityActionsToday ?? 0;
  const pendingFocus = useGyanDoubtsPendingFocusMs();
  const liveFocusMs = Math.min(FIVE_MIN_MS, focusMs + pendingFocus);

  const timeDone = Boolean(data?.gyanPlusDone) || liveFocusMs >= FIVE_MIN_MS;
  const savesDone = saves >= 1;
  const communityDone = community >= 1;
  const timePct = useMemo(
    () => Math.min(100, Math.round((100 * liveFocusMs) / FIVE_MIN_MS)),
    [liveFocusMs]
  );
  const doneCount = (timeDone ? 1 : 0) + (savesDone ? 1 : 0) + (communityDone ? 1 : 0);

  return {
    user,
    data,
    status,
    load,
    focusMs,
    saves,
    community,
    timeDone,
    savesDone,
    communityDone,
    timePct,
    doneCount,
  };
}

function useChecklistPanelEffects(open: boolean, load: () => Promise<void>, onEscape?: () => void) {
  useEffect(() => {
    if (!open) return;
    return startVisiblePoll({ intervalMs: POLL_MS, onTick: () => void load() });
  }, [load, open]);

  useEffect(() => {
    let debounceId: number | null = null;
    const scheduleLoad = () => {
      if (debounceId) window.clearTimeout(debounceId);
      debounceId = window.setTimeout(() => {
        debounceId = null;
        void load();
      }, REFRESH_DEBOUNCE_MS);
    };
    const onGyanBump = () => {
      if (!open) return;
      scheduleLoad();
    };
    window.addEventListener(EDUBLAST_GYAN_DAILY_CHECKLIST_REFRESH, onGyanBump);
    return () => {
      if (debounceId) window.clearTimeout(debounceId);
      window.removeEventListener(EDUBLAST_GYAN_DAILY_CHECKLIST_REFRESH, onGyanBump);
    };
  }, [load, open]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  useEffect(() => {
    if (!open || !onEscape) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onEscape();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onEscape]);
}

/**
 * Viewport-fixed left rail for mobile — opens centered checklist panel.
 */
export function GyanDailyChecklistTracker() {
  const [open, setOpen] = useState(false);
  const checklist = useGyanChecklistData();
  const close = useCallback(() => setOpen(false), []);
  useChecklistPanelEffects(open, checklist.load, close);

  if (!checklist.user?.id) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "fixed z-[44] left-0 top-[max(5rem,22vh)] sm:top-[max(7rem,28vh)] flex h-10 w-7 sm:h-[4.25rem] sm:w-[3.25rem] flex-col items-center justify-center gap-0 sm:gap-0.5 rounded-r-xl sm:rounded-r-2xl border-y border-r border-emerald-500/45 bg-gradient-to-b from-emerald-600 to-emerald-700 text-white shadow-lg shadow-emerald-950/25 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          open
            ? "from-emerald-500 to-emerald-600 ring-2 ring-white/30"
            : "hover:from-emerald-500 hover:to-emerald-600"
        )}
        aria-label={open ? "Close Gyan++ daily checklist" : "Open Gyan++ daily checklist"}
        aria-expanded={open}
      >
        <ListChecks className="h-3.5 w-3.5 shrink-0 sm:h-5 sm:w-5" aria-hidden />
        <span className="hidden sm:block text-[8px] font-extrabold uppercase tracking-tight leading-none text-center px-0.5">
          Daily
        </span>
        <span className="hidden sm:block text-[8px] font-extrabold uppercase tracking-tight leading-none text-center px-0.5 -mt-0.5">
          Gyan
        </span>
      </button>

      <GyanChecklistPanel
        open={open}
        onClose={close}
        status={checklist.status}
        data={checklist.data}
        doneCount={checklist.doneCount}
        timeDone={checklist.timeDone}
        savesDone={checklist.savesDone}
        communityDone={checklist.communityDone}
        focusMs={checklist.focusMs}
        timePct={checklist.timePct}
        saves={checklist.saves}
        community={checklist.community}
        onRefresh={() => void checklist.load()}
      />
    </>
  );
}

/** Inline sidebar card on desktop — opens the same centered panel. */
export function GyanDailyChecklistSidebarCard() {
  const [open, setOpen] = useState(false);
  const checklist = useGyanChecklistData();
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    void checklist.load();
  }, [checklist.load]);

  useChecklistPanelEffects(open, checklist.load, close);

  const allDone = checklist.doneCount === 3;

  if (!checklist.user?.id) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "w-full rounded-xl border px-3.5 py-3 text-left transition-all duration-200",
          allDone
            ? "border-emerald-500/30 bg-emerald-950/20 hover:border-emerald-500/50"
            : "border-white/[0.06] bg-[#070c18]/60 hover:border-white/[0.1]"
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ListChecks
              className={cn("h-3.5 w-3.5 shrink-0", allDone ? "text-emerald-400" : "text-slate-400")}
            />
            <span className={cn("text-xs font-semibold", allDone ? "text-emerald-400" : "text-white")}>
              Daily Gyan
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {[checklist.timeDone, checklist.savesDone, checklist.communityDone].map((done, i) => (
              <span
                key={i}
                className={cn(
                  "h-2 w-2 rounded-full transition-all",
                  done ? "bg-emerald-500" : "bg-white/10"
                )}
              />
            ))}
          </div>
        </div>
        <p className="mt-1 text-[11px] text-slate-500">
          {allDone ? "All 3 tasks done today" : `${checklist.doneCount}/3 tasks · tap to view`}
        </p>
      </button>

      <GyanChecklistPanel
        open={open}
        onClose={close}
        status={checklist.status}
        data={checklist.data}
        doneCount={checklist.doneCount}
        timeDone={checklist.timeDone}
        savesDone={checklist.savesDone}
        communityDone={checklist.communityDone}
        focusMs={checklist.focusMs}
        timePct={checklist.timePct}
        saves={checklist.saves}
        community={checklist.community}
        onRefresh={() => void checklist.load()}
      />
    </>
  );
}
