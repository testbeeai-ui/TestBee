"use client";

import Link from "next/link";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  Check,
  Coins,
  Flame,
  HelpCircle,
  Lock,
  MessageCircle,
  Play,
  ChevronRight,
  RefreshCw,
  SquareRadical,
  TrendingUp,
  UserX,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useBuddyDashboardLive } from "@/hooks/useBuddyDashboardLive";
import { useMemo } from "react";
import {
  activityGreenLevelFromStudyMs,
  addDaysLocal,
  formatPresenceMsForTooltip,
  formatSavedStudyMinutesLabel,
  formatStudyMsForTooltip,
  localDayKeyFromDate,
  startOfLocalDay,
} from "@/lib/dashboard/dashboardDayActivity";
import {
  endBuddyPair,
  type BuddyAdvancedDashboardResponse,
  type BuddyProfile,
  withBuddyRdm,
} from "@/lib/buddy/buddyClient";
import type { BuddyPrivacyKey } from "@/lib/buddy/buddyPrivacy";
import {
  BUDDY_AVA_GRADIENTS,
  BUDDY_CARD_ACCENT,
  type BuddyCardAccent,
} from "@/components/refer-earn/learning-buddy-advanced/learningBuddyAdvancedStyles";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, type ReactNode } from "react";
import { fetchRdmConfig } from "@/lib/rdm/rdmConfig";

function buddyInitial(name: string | null): string {
  if (!name?.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return parts[0]!.charAt(0).toUpperCase();
}

function formatMockTakenAt(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "Just now";
  if (ms < 3600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3600_000)}h ago`;
  const days = Math.floor(ms / 86_400_000);
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

function formatMsShort(ms: number): string {
  if (ms < 60_000) return "<1m";
  const h = ms / 3600_000;
  if (h >= 1) return `${h.toFixed(1)}h`;
  return `${Math.round(ms / 60_000)}m`;
}

function LockedNotice({ message }: { message: string }) {
  return (
    <div className="mt-3 flex items-start gap-2 rounded-lg border border-white/8 bg-black/30 px-3 py-2.5 text-[11px] leading-snug text-slate-500">
      <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-600" />
      {message}
    </div>
  );
}

type BuddyDetailPanelProps = {
  buddy: BuddyProfile;
  onUnbuddy: () => void;
};

export function BuddyDetailPanel({ buddy, onUnbuddy }: BuddyDetailPanelProps) {
  const { toast } = useToast();
  const { data, error, refresh } = useBuddyDashboardLive(buddy);
  const [unbuddyOpen, setUnbuddyOpen] = useState(false);
  const [unbuddying, setUnbuddying] = useState(false);

  const dashboardForBuddy = data?.buddy?.id === buddy.id ? data : null;
  const displayBuddy = withBuddyRdm(dashboardForBuddy?.buddy ?? buddy);
  const live = Boolean(dashboardForBuddy?.buddyOnline);

  const handleUnbuddy = async () => {
    setUnbuddying(true);
    try {
      await endBuddyPair(buddy.id);
      toast({ title: "Buddy removed" });
      onUnbuddy();
    } catch (err) {
      toast({
        title: "Couldn't unbuddy",
        description: err instanceof Error ? err.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setUnbuddying(false);
      setUnbuddyOpen(false);
    }
  };

  const isLocked = (key: BuddyPrivacyKey) =>
    dashboardForBuddy != null && !dashboardForBuddy.visibility[key];

  const avatarRing = BUDDY_AVA_GRADIENTS[0]!;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="relative flex flex-wrap items-center gap-3 border-b border-white/[0.06] bg-gradient-to-r from-[#12182a]/90 via-[#141c2e]/80 to-[#101622]/90 px-4 py-4 backdrop-blur-sm">
        <div
          className="pointer-events-none absolute -left-8 top-0 h-24 w-24 rounded-full bg-emerald-500/10 blur-2xl"
          aria-hidden
        />
        <span
          className={cn(
            "relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-bold shadow-lg",
            avatarRing
          )}
        >
          {buddyInitial(displayBuddy.name)}
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#12182a]",
              live ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-slate-600"
            )}
          />
        </span>
        <div className="relative min-w-0 flex-1">
          <p className="text-lg font-semibold tracking-tight text-white">
            {displayBuddy.name ?? "Study buddy"}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {live ? (
              <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300 ring-1 ring-emerald-400/30">
                Online now
              </span>
            ) : (
              <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] text-slate-500 ring-1 ring-white/10">
                Away
              </span>
            )}
            {displayBuddy.classLevel ? (
              <span className="rounded-full bg-sky-500/15 px-2.5 py-0.5 text-[11px] font-medium text-sky-300 ring-1 ring-sky-400/25">
                Class {displayBuddy.classLevel}
              </span>
            ) : null}
            {!isLocked("share_rdm") ? (
              <span className="rounded-full bg-violet-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-violet-200 ring-1 ring-violet-400/25">
                {displayBuddy.rdm.toLocaleString("en-IN")} RDM
              </span>
            ) : null}
          </div>
        </div>
        <div className="relative flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-full border-white/12 bg-white/[0.04] text-xs text-slate-300 hover:bg-white/[0.08]"
            onClick={() => refresh()}
          >
            <RefreshCw className="mr-1 h-3.5 w-3.5" />
            Refresh
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-xs font-semibold text-white shadow-md shadow-violet-900/30 hover:from-violet-500 hover:to-fuchsia-500"
            onClick={() =>
              toast({
                title: "Chat is coming soon",
                description: displayBuddy.name
                  ? `We're building a private chat with ${displayBuddy.name} — stay tuned!`
                  : "Private buddy chat is coming soon.",
              })
            }
          >
            <MessageCircle className="mr-1 h-3.5 w-3.5" />
            Chat
          </Button>
          {unbuddyOpen ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 border-[#334060] text-xs"
                onClick={() => setUnbuddyOpen(false)}
                disabled={unbuddying}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-8 bg-rose-600 text-xs hover:bg-rose-500"
                onClick={() => void handleUnbuddy()}
                disabled={unbuddying}
              >
                {unbuddying ? "…" : "Confirm"}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 border-[#334060] bg-transparent text-xs text-[#9BA3B8]"
              onClick={() => setUnbuddyOpen(true)}
            >
              <UserX className="mr-1 h-3.5 w-3.5" />
              Unbuddy
            </Button>
          )}
        </div>
      </div>

      {error ? <p className="px-4 py-3 text-xs text-rose-300">{error}</p> : null}

      {!dashboardForBuddy ? (
        <div className="grid flex-1 gap-3 p-4 sm:grid-cols-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className={cn(
                "h-36 animate-pulse rounded-xl border border-white/[0.06] bg-gradient-to-br from-white/[0.04] to-transparent",
                i === 1 && "sm:col-span-2"
              )}
            />
          ))}
        </div>
      ) : (
        <ActivityGrid data={dashboardForBuddy} isLocked={isLocked} buddyName={displayBuddy.name} />
      )}
    </div>
  );
}

function greenCellClass(level: 0 | 1 | 2 | 3, isToday: boolean): string {
  const ring = isToday ? "ring-2 ring-teal-400 ring-offset-2 ring-offset-background" : "";
  const base = "rounded-lg border transition-all duration-200 " + ring;
  switch (level) {
    case 0:
      return cn(base, "border-red-500/35 bg-red-950/55 text-red-100");
    case 1:
      return cn(
        base,
        "border-emerald-400/45 bg-emerald-400/28 text-emerald-950 dark:text-emerald-50"
      );
    case 2:
      return cn(base, "border-emerald-500/45 bg-emerald-600/60 text-white");
    case 3:
      return cn(base, "border-emerald-700/50 bg-emerald-950/90 text-emerald-50");
  }
}

function ActivityGrid({
  data,
  isLocked,
  buddyName,
}: {
  data: BuddyAdvancedDashboardResponse;
  isLocked: (key: BuddyPrivacyKey) => boolean;
  buddyName: string | null;
}) {
  const name = buddyName ?? "Buddy";
  const mockRecentRows = data.mcqRecent.filter((r) => r.source === "mock").slice(0, 5);

  const [heatmapMode, setHeatmapMode] = useState<"7" | "30">("7");
  const [studyStreakBonusWeek, setStudyStreakBonusWeek] = useState(3);
  const [studyStreakBonusRdm, setStudyStreakBonusRdm] = useState(150);

  useEffect(() => {
    let cancelled = false;
    void fetchRdmConfig().then((cfg) => {
      if (cancelled) return;
      setStudyStreakBonusWeek(Math.max(1, Math.round(cfg.study_streak_bonus_week_number)));
      setStudyStreakBonusRdm(Math.max(0, Math.round(cfg.study_streak_bonus_rdm)));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const now = useMemo(() => new Date(), []);
  const monthDays = useMemo(
    () => new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(),
    [now]
  );

  const { studyMsByDay, presenceMsByDay } = useMemo(() => {
    const studyMap = new Map<string, number>();
    const presenceMap = new Map<string, number>();
    const days = data.advanced.streak?.studyDays ?? [];
    for (const d of days) {
      studyMap.set(d.day, d.active_ms);
      presenceMap.set(d.day, d.presence_ms);
    }
    return { studyMsByDay: studyMap, presenceMsByDay: presenceMap };
  }, [data.advanced.streak?.studyDays]);

  const last7Series = useMemo(() => {
    const today = startOfLocalDay(now);
    const todayKey = localDayKeyFromDate(today);
    const out: {
      date: Date;
      key: string;
      activeMs: number;
      presenceMs: number;
      level: 0 | 1 | 2 | 3;
      label: string;
      tooltipTitle: string;
    }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = addDaysLocal(today, -i);
      const key = localDayKeyFromDate(d);
      const activeMs = studyMsByDay.get(key) ?? 0;
      const presenceMs = presenceMsByDay.get(key) ?? 0;
      const heatMs = Math.max(presenceMs, activeMs);
      out.push({
        date: d,
        key,
        activeMs,
        presenceMs,
        level: activityGreenLevelFromStudyMs(heatMs),
        label: formatSavedStudyMinutesLabel(presenceMs),
        tooltipTitle: `${d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · ${formatPresenceMsForTooltip(presenceMs)} · ${formatStudyMsForTooltip(activeMs)}`,
      });
    }
    return out;
  }, [now, studyMsByDay, presenceMsByDay]);

  const monthGrid = useMemo(() => {
    const y = now.getFullYear();
    const mon = now.getMonth();
    const first = new Date(y, mon, 1);
    let offset = first.getDay() - 1;
    if (offset < 0) offset += 7;
    const todayStart = startOfLocalDay(now);
    const todayKey = localDayKeyFromDate(todayStart);
    const cells: {
      day: number | null;
      key: string | null;
      activeMs: number;
      presenceMs: number;
      level: 0 | 1 | 2 | 3;
      label: string;
      tooltipTitle: string | null;
    }[] = [];
    for (let i = 0; i < offset; i++) {
      cells.push({
        day: null,
        key: null,
        activeMs: 0,
        presenceMs: 0,
        level: 0,
        label: "—",
        tooltipTitle: null,
      });
    }
    for (let day = 1; day <= monthDays; day++) {
      const d = new Date(y, mon, day);
      const key = localDayKeyFromDate(d);
      const activeMs = studyMsByDay.get(key) ?? 0;
      const presenceMs = presenceMsByDay.get(key) ?? 0;
      const heatMs = Math.max(presenceMs, activeMs);
      cells.push({
        day,
        key,
        activeMs,
        presenceMs,
        level: activityGreenLevelFromStudyMs(heatMs),
        label: formatSavedStudyMinutesLabel(presenceMs),
        tooltipTitle: `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${formatPresenceMsForTooltip(presenceMs)} · ${formatStudyMsForTooltip(activeMs)}`,
      });
    }
    while (cells.length % 7 !== 0) {
      cells.push({
        day: null,
        key: null,
        activeMs: 0,
        presenceMs: 0,
        level: 0,
        label: "—",
        tooltipTitle: null,
      });
    }
    const monthLong = now.toLocaleDateString("en-US", { month: "long" }).toUpperCase();
    const year = now.getFullYear();
    const monthlyMapHeading = `MONTHLY MAP — ${monthLong} ${year}`;
    return {
      cells,
      monthlyMapHeading,
      todayStart,
    };
  }, [monthDays, now, studyMsByDay, presenceMsByDay]);

  return (
    <div className="grid flex-1 auto-rows-min grid-cols-1 gap-3 overflow-y-auto p-4 sm:grid-cols-2">
      <ActCard full accent="teal">
        {isLocked("share_streak") || !data.advanced.streak ? (
          <>
            <ActHead accent="teal" icon={Flame} label="Streak and consistency" time="Live" />
            <LockedNotice message={`${name} keeps streak data private`} />
          </>
        ) : (
          <>
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-500/10">
                  <CalendarDays className="h-4 w-4 text-[#1D9E75]" />
                </span>
                <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-200">
                  Study streak
                </span>
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium text-[#5C6480]">
                  Live
                </span>
              </div>
              <span className="inline-flex w-fit items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/5 px-2.5 py-0.5 text-[10px] font-bold text-amber-400 sm:text-[11px]">
                <Flame className="h-3 w-3 text-amber-500" />
                Week {studyStreakBonusWeek} bonus: +{studyStreakBonusRdm.toLocaleString("en-IN")}{" "}
                RDM
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <StatCell
                value={String(data.advanced.streak.dayStreak)}
                label="Day streak"
                valueClass="text-[#1D9E75]"
              />
              <StatCell
                value={String(data.advanced.streak.activeDays60d)}
                label="Active days (60d)"
              />
              <StatCell
                value={formatMsShort(data.advanced.streak.avgDailyMs)}
                label="Avg daily"
                valueClass="text-[#AFA9EC]"
              />
            </div>

            <div
              className="mb-3 mt-4 inline-flex rounded-full border border-white/[0.08] bg-[#0d1527]/60 p-0.5"
              role="group"
              aria-label="Study streak map range"
            >
              <button
                type="button"
                onClick={() => setHeatmapMode("7")}
                className={cn(
                  "rounded-full px-3.5 py-1 text-xs font-bold transition-all duration-200",
                  heatmapMode === "7"
                    ? "bg-[#1D9E75] text-white shadow-md shadow-[#1D9E75]/20"
                    : "text-slate-400 hover:text-slate-200"
                )}
              >
                Last 7 days
              </button>
              <button
                type="button"
                onClick={() => setHeatmapMode("30")}
                className={cn(
                  "rounded-full px-3.5 py-1 text-xs font-bold transition-all duration-200",
                  heatmapMode === "30"
                    ? "bg-[#1D9E75] text-white shadow-md shadow-[#1D9E75]/20"
                    : "text-slate-400 hover:text-slate-200"
                )}
              >
                Last 30 days
              </button>
            </div>

            {heatmapMode === "30" ? (
              <p className="mb-2 text-center text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 sm:mb-3 sm:text-[11px] sm:tracking-[0.18em]">
                {monthGrid.monthlyMapHeading}
              </p>
            ) : null}

            {heatmapMode === "7" ? (
              <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {last7Series.map((cell) => {
                  const isToday =
                    localDayKeyFromDate(cell.date) === localDayKeyFromDate(startOfLocalDay(now));
                  return (
                    <div
                      key={cell.key}
                      title={cell.tooltipTitle}
                      className={cn(
                        "flex min-h-[56px] flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 sm:min-h-[72px] sm:px-2 sm:py-2",
                        greenCellClass(cell.level, isToday)
                      )}
                    >
                      <span className="text-[9px] font-bold uppercase text-slate-400 sm:text-[10px]">
                        {cell.date.toLocaleDateString(undefined, { weekday: "short" })}
                      </span>
                      <span className="text-xs font-extrabold tabular-nums">{cell.label}</span>
                      {isToday ? (
                        <span className="text-[9px] font-semibold text-teal-400 sm:text-[10px]">
                          Today
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div>
                <div className="grid grid-cols-7 gap-1 text-center text-[9px] font-bold text-slate-400 sm:gap-1.5 sm:text-[10px]">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                    <div key={d}>{d}</div>
                  ))}
                </div>
                <div className="mt-1 grid grid-cols-7 gap-1 sm:gap-1.5">
                  {monthGrid.cells.map((cell, idx) => {
                    if (cell.day == null) {
                      return (
                        <div
                          key={`pad-${idx}`}
                          className="aspect-square rounded-lg bg-transparent"
                        />
                      );
                    }
                    const d = new Date(now.getFullYear(), now.getMonth(), cell.day);
                    const isToday = startOfLocalDay(d).getTime() === monthGrid.todayStart.getTime();
                    return (
                      <div
                        key={cell.key ?? `day-${cell.day}`}
                        title={cell.tooltipTitle ?? undefined}
                        className={cn(
                          "flex aspect-square flex-col items-center justify-center gap-0.5 p-0.5 text-[9px] font-bold sm:p-1 sm:text-[10px]",
                          greenCellClass(cell.level, isToday)
                        )}
                      >
                        <span>{cell.day}</span>
                        <span className="text-[9px] opacity-90">{cell.label}</span>
                        {isToday ? <span className="text-[8px] text-teal-300">Today</span> : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-[#5C6480]">
              <span className="text-slate-400">Less</span>
              <span className="h-3 w-8 rounded bg-gradient-to-r from-red-950/70 via-emerald-500/60 to-emerald-950" />
              <span className="text-slate-400 font-medium">More</span>
            </div>
          </>
        )}
      </ActCard>

      <ActCard accent="blue">
        <ActHead
          accent="blue"
          icon={BarChart3}
          label="Mock tests (Testbee)"
          time={mockRecentRows.length > 0 ? `Recent ${mockRecentRows.length}` : "Recent"}
        />
        {isLocked("share_mocks") ? (
          <LockedNotice message={`${name} keeps mock scores private`} />
        ) : (
          <>
            {mockRecentRows.length > 0 ? (
              mockRecentRows.map((row) => {
                const pct =
                  typeof row.scorePercent === "number" && Number.isFinite(row.scorePercent)
                    ? Math.round(row.scorePercent)
                    : null;
                return (
                  <ActRow
                    key={row.id}
                    title={row.paperName}
                    sub={formatMockTakenAt(row.takenAt)}
                    value={pct != null ? `${pct}%` : "—"}
                    valueClass={
                      pct != null && pct >= 70
                        ? "text-emerald-400"
                        : pct != null
                          ? "text-amber-400"
                          : undefined
                    }
                    href={row.href}
                  />
                );
              })
            ) : data.advanced.mocks && data.advanced.mocks.recent.length > 0 ? (
              data.advanced.mocks.recent.map((row, i) => (
                <ActRow
                  key={i}
                  title={row.title}
                  sub={row.subtitle}
                  value={row.scorePercent != null ? `${row.scorePercent}%` : "—"}
                  valueClass={
                    row.scorePercent != null && row.scorePercent >= 70
                      ? "text-emerald-400"
                      : "text-amber-400"
                  }
                  href={row.href}
                />
              ))
            ) : (
              <p className="text-[11px] text-slate-500">No Testbee mock attempts yet.</p>
            )}
            {data.advanced.mocks ? (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <StatCell
                  value={String(data.advanced.mocks.mocksThisMonth)}
                  label="Mocks this month"
                />
                <StatCell
                  value={
                    data.advanced.mocks.avgAccuracy != null
                      ? `${data.advanced.mocks.avgAccuracy}%`
                      : "—"
                  }
                  label="Avg accuracy (recent)"
                  valueClass="text-emerald-400"
                />
              </div>
            ) : null}
          </>
        )}
      </ActCard>

      <ActCard accent="amber">
        <ActHead accent="amber" icon={HelpCircle} label="Gyan++ activity" time="Recent" />
        {isLocked("share_gyan") ? (
          <LockedNotice message={`${name} keeps Gyan++ private`} />
        ) : data.gyanRecent.length === 0 ? (
          <p className="text-[11px] text-slate-500">No recent Gyan++ activity.</p>
        ) : (
          data.gyanRecent
            .slice(0, 2)
            .map((row) => (
              <ActRow
                key={row.id}
                title={row.title}
                sub={row.kind === "doubt" ? "Asked on wall" : "Answer"}
                href={row.href}
              />
            ))
        )}
      </ActCard>

      <ActCard accent="lime">
        <ActHead accent="lime" icon={Play} label="Play arena" time="Today" />
        {isLocked("share_play") ? (
          <LockedNotice message={`${name} keeps Play scores private`} />
        ) : (
          <>
            {data.playArena.recent.length === 0 ? (
              <p className="text-[11px] text-slate-500">
                No Play activity yet today — tap Play to start.
              </p>
            ) : (
              data.playArena.recent.map((row) => <PlayActRow key={row.id} row={row} />)
            )}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <StatCell
                value={String(data.playArena.playRdmMissedToday)}
                label="Play RDM missed"
                valueClass="text-emerald-400"
              />
              <StatCell
                value={String(data.playArena.blitzRoundsToday)}
                label="Blitz rounds today"
              />
            </div>
            {data.playArena.gauntletStreakDays >= 7 ? (
              <p className="mt-2 text-[11px] font-medium text-lime-300/90">
                {data.playArena.gauntletStreakDays}d gauntlet streak ·{" "}
                {data.playArena.rdmEarnedLast7Days} Play RDM (7d)
              </p>
            ) : null}
          </>
        )}
      </ActCard>

      <ActCard accent="purple">
        <ActHead accent="purple" icon={BookOpen} label="Subtopics and revision" time="Recent" />
        {isLocked("share_subtopics") ? (
          <LockedNotice message={`${name} keeps subtopic progress private`} />
        ) : (
          <>
            {data.subtopic.completedRecent.slice(0, 2).map((row, i) => (
              <ActRow
                key={i}
                title={`${row.subject ?? ""} · ${row.subtopic}`.replace(/^ · /, "")}
                sub="Marked complete"
                badge="Done"
                href={row.href ?? undefined}
              />
            ))}
            {data.subtopic.lastOn ? (
              <ActRow
                title={`${data.subtopic.lastOn.subject ?? ""} · ${data.subtopic.lastOn.subtopic ?? "Subtopic"}`.replace(
                  /^ · /,
                  ""
                )}
                sub="Last on subtopic"
                badge={data.subtopic.lastOn.isRecent ? "Active" : undefined}
                href={data.subtopic.lastOn.href ?? undefined}
              />
            ) : null}
          </>
        )}
      </ActCard>

      <ActCard accent="amber">
        <ActHead accent="amber" icon={Coins} label="RDM and EduFund" time="Live" />
        {isLocked("share_edufund") || isLocked("share_rdm") || !data.advanced.edufund ? (
          <LockedNotice message={`${name} keeps RDM / EduFund private`} />
        ) : (
          <>
            {data.advanced.edufund.nextTierName ? (
              <ProgressRow
                label={`${data.advanced.edufund.nextTierName} tier progress`}
                value={`${data.advanced.edufund.rdm.toLocaleString("en-IN")} / ${data.advanced.edufund.nextTierNeed?.toLocaleString("en-IN") ?? "—"}`}
                pct={data.advanced.edufund.nextTierProgressPct}
                fillClass="bg-[#7F77DD]"
              />
            ) : null}
            <ProgressRow
              label="Active days (EduFund)"
              value={`${data.advanced.edufund.activeDays60d} / ${data.advanced.edufund.activeDaysGoal}`}
              pct={Math.min(
                100,
                Math.round(
                  (100 * data.advanced.edufund.activeDays60d) / data.advanced.edufund.activeDaysGoal
                )
              )}
              fillClass="bg-[#1D9E75]"
            />
            <ActRow
              title="Earned today"
              value={`+${data.advanced.edufund.earnedTodayRdm} RDM`}
              valueClass="text-[#1D9E75]"
            />
          </>
        )}
      </ActCard>

      <ActCard accent="blue">
        <ActHead accent="blue" icon={MessageCircle} label="Community wall" time="Recent" />
        {isLocked("share_community") ? (
          <LockedNotice message={`${name} keeps community posts private`} />
        ) : data.rightNow.kind === "community_posted" ? (
          <>
            <ActRow title={data.rightNow.title} sub="Posted on community" />
            {"href" in data.rightNow && data.rightNow.href ? (
              <Link
                href={data.rightNow.href}
                className="mt-2 inline-block text-[11px] font-medium text-sky-400 hover:text-sky-300 hover:underline"
              >
                Open community post →
              </Link>
            ) : null}
          </>
        ) : (
          <p className="text-[11px] text-slate-500">No recent community posts.</p>
        )}
      </ActCard>

      <ActCard accent="lime">
        <ActHead accent="lime" icon={TrendingUp} label="Subject accuracy" time="This week" />
        {isLocked("share_mocks") || !data.advanced.subjectAccuracy ? (
          <LockedNotice message="Subject accuracy requires mock/quiz sharing" />
        ) : (
          data.advanced.subjectAccuracy.subjects.map((s) => {
            const fillClass =
              s.subject === "physics"
                ? "bg-[#378ADD]"
                : s.subject === "math"
                  ? "bg-[#7F77DD]"
                  : "bg-[#EF9F27]";
            const valueClass =
              s.hasData && s.pct >= 70
                ? "text-emerald-400"
                : s.hasData
                  ? "text-orange-300"
                  : "text-slate-500";
            return (
              <ProgressRow
                key={s.subject}
                label={s.name}
                value={s.hasData ? `${s.pct}%` : "—"}
                pct={s.hasData ? s.pct : 0}
                fillClass={s.hasData ? fillClass : "bg-slate-700/80"}
                valueClass={valueClass}
              />
            );
          })
        )}
      </ActCard>
    </div>
  );
}

function ActCard({
  children,
  full,
  accent = "purple",
  className,
}: {
  children: ReactNode;
  full?: boolean;
  accent?: BuddyCardAccent;
  className?: string;
}) {
  const a = BUDDY_CARD_ACCENT[accent];
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-3.5 backdrop-blur-sm transition-shadow hover:shadow-lg",
        a.border,
        a.glow,
        full && "sm:col-span-2",
        className
      )}
    >
      <div
        className={cn("absolute inset-x-0 top-0 h-px bg-gradient-to-r", a.topLine)}
        aria-hidden
      />
      {children}
    </div>
  );
}

function ActHead({
  icon: Icon,
  accent,
  label,
  time,
}: {
  icon: LucideIcon;
  accent: BuddyCardAccent;
  label: string;
  time: string;
}) {
  const a = BUDDY_CARD_ACCENT[accent];
  return (
    <div className="mb-3 flex items-center gap-2">
      <span
        className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", a.iconBg)}
      >
        <Icon className={cn("h-4 w-4", a.iconText)} />
      </span>
      <span className={cn("text-[11px] font-bold uppercase tracking-[0.1em]", a.label)}>
        {label}
      </span>
      <span className="ml-auto rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium text-slate-500">
        {time}
      </span>
    </div>
  );
}

function StatCell({
  value,
  label,
  valueClass,
}: {
  value: string;
  label: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-black/25 px-2 py-2.5 text-center shadow-inner">
      <p className={cn("text-xl font-semibold tabular-nums text-white", valueClass)}>{value}</p>
      <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
    </div>
  );
}

function PlayActRowIcon({
  kind,
}: {
  kind: BuddyAdvancedDashboardResponse["playArena"]["recent"][number]["kind"];
}) {
  const className = "h-3.5 w-3.5";
  switch (kind) {
    case "daily_dose":
      return <Zap className={className} />;
    case "quant_blitz":
      return <SquareRadical className={className} />;
    case "numerals":
      return <Flame className={className} />;
    default:
      return <Play className={className} />;
  }
}

function PlayActRow({
  row,
}: {
  row: BuddyAdvancedDashboardResponse["playArena"]["recent"][number];
}) {
  const body = (
    <div className="flex items-start gap-2.5 border-b border-white/[0.06] py-2.5 last:border-0">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-lime-500/10 text-lime-300 ring-1 ring-lime-400/15">
        <PlayActRowIcon kind={row.kind} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-slate-100">{row.title}</p>
        {row.subtitle ? (
          <p className="truncate text-[11px] text-slate-500">{row.subtitle}</p>
        ) : null}
      </div>
      {row.rdmBadge ? (
        <span className="shrink-0 rounded-full bg-emerald-500/12 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 ring-1 ring-emerald-400/20">
          {row.rdmBadge}
        </span>
      ) : null}
    </div>
  );
  return (
    <Link
      href={row.href}
      className="group/row block cursor-pointer rounded-md transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400/35"
    >
      {body}
    </Link>
  );
}

function ActRow({
  title,
  sub,
  value,
  valueClass,
  badge,
  href,
}: {
  title: string;
  sub?: string;
  value?: string;
  valueClass?: string;
  badge?: string;
  href?: string;
}) {
  const body = (
    <div className="flex items-start gap-2 border-b border-white/[0.06] py-2 last:border-0">
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-xs font-medium",
            href
              ? "text-slate-100 group-hover/row:text-white group-hover/row:underline"
              : "text-slate-200"
          )}
        >
          {title}
        </p>
        {sub ? <p className="text-[11px] text-slate-500">{sub}</p> : null}
      </div>
      {value ? (
        <span className={cn("shrink-0 text-xs font-medium", valueClass)}>{value}</span>
      ) : null}
      {badge ? (
        <span className="shrink-0 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300 ring-1 ring-emerald-400/20">
          {badge}
        </span>
      ) : null}
      {href ? (
        <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-600 transition group-hover/row:text-emerald-300" />
      ) : null}
    </div>
  );
  if (href) {
    return (
      <Link
        href={href}
        className="group/row block cursor-pointer rounded-md transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/35"
      >
        {body}
      </Link>
    );
  }
  return body;
}

function ProgressRow({
  label,
  value,
  pct,
  fillClass,
  valueClass,
}: {
  label: string;
  value: string;
  pct: number;
  fillClass: string;
  valueClass?: string;
}) {
  return (
    <div className="mt-2 first:mt-0">
      <div className="mb-1 flex justify-between text-[11px]">
        <span className="text-[#9BA3B8]">{label}</span>
        <span className={cn("font-medium", valueClass ?? "text-[#E8EAF0]")}>{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-black/40 ring-1 ring-white/[0.06]">
        <div
          className={cn("h-full rounded-full shadow-sm transition-[width]", fillClass)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
