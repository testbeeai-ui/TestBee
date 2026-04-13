import type { AnswerResult } from "@/types";

/** GitHub-style: weeks run Sunday → Saturday (columns left = older). */
export type HeatmapIntensity = 0 | 1 | 2 | 3 | 4;

export type HeatmapDayCell = {
  intensity: HeatmapIntensity;
  isFuture: boolean;
  /** Local calendar day (start of day). */
  day: Date;
  count: number;
};

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Sunday-start week (matches GitHub contribution graph). */
export function startOfWeekSunday(d: Date): Date {
  const s = startOfLocalDay(d);
  const dow = s.getDay();
  s.setDate(s.getDate() - dow);
  return s;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function localDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function intensityFromCount(n: number): HeatmapIntensity {
  if (n <= 0) return 0;
  if (n <= 2) return 1;
  if (n <= 5) return 2;
  if (n <= 9) return 3;
  return 4;
}

export type HeatmapMonthTick = { weekIndex: number; label: string };

export type ActivityHeatmapModel = {
  numWeeks: number;
  /** Column-major: week0 Sun..Sat, week1 Sun..Sat, … */
  cells: HeatmapDayCell[];
  monthTicks: HeatmapMonthTick[];
  /** Number of answered questions represented in the visible window. */
  contributionsInRange: number;
  rangeLabel: string;
  /** First column’s Sunday (fixed rolling window start). */
  startSunday: Date;
};

/** Fixed 6-month board for current year: Jan -> Jun. */
const DISPLAY_START_MONTH = 0; // Jan
const DISPLAY_MONTH_COUNT = 6; // Jan..Jun

/** Builds contribution-style cells for a fixed Jan->Jun window. */
export function buildActivityHeatmapModel(
  results: AnswerResult[],
  accountStartInput: Date | null,
  now: Date = new Date()
): ActivityHeatmapModel {
  const today = startOfLocalDay(now);

  let anchor: Date;
  if (accountStartInput) {
    anchor = startOfLocalDay(accountStartInput);
  } else if (results.length > 0) {
    anchor = startOfLocalDay(new Date(Math.min(...results.map((r) => r.timestamp))));
  } else {
    anchor = addDays(today, -364);
  }
  if (anchor > today) anchor = today;

  const anchorDay = startOfLocalDay(anchor);

  const displayYear = today.getFullYear();
  const windowStartDay = new Date(displayYear, DISPLAY_START_MONTH, 1);
  const windowEndDay = startOfLocalDay(
    new Date(displayYear, DISPLAY_START_MONTH + DISPLAY_MONTH_COUNT, 0)
  );
  const effectiveToday = today < windowEndDay ? today : windowEndDay;

  const startSunday = startOfWeekSunday(windowStartDay);
  const endSunday = startOfWeekSunday(windowEndDay);
  const numWeeks =
    Math.floor((endSunday.getTime() - startSunday.getTime()) / (7 * 86400000)) + 1;

  const counts = new Map<string, number>();
  for (const r of results) {
    const k = localDayKey(startOfLocalDay(new Date(r.timestamp)));
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }

  const cells: HeatmapDayCell[] = [];
  const totalCells = numWeeks * 7;
  let contributionsInRange = 0;

  for (let i = 0; i < totalCells; i++) {
    const day = addDays(startSunday, i);
    const dayStart = startOfLocalDay(day);
    const isFuture = dayStart > effectiveToday;
    const beforeWindow = dayStart < windowStartDay || dayStart > windowEndDay;
    const beforeAccount = dayStart < anchorDay;
    const k = localDayKey(dayStart);
    const count = beforeWindow || beforeAccount || isFuture ? 0 : counts.get(k) ?? 0;
    const intensity = beforeWindow || beforeAccount || isFuture ? 0 : intensityFromCount(count);
    contributionsInRange += count;
    cells.push({ intensity, isFuture, day: dayStart, count });
  }

  const monthTicks: HeatmapMonthTick[] = [];
  for (let w = 0; w < numWeeks; w++) {
    const weekSunday = addDays(startSunday, w * 7);
    const prevSunday = w > 0 ? addDays(startSunday, (w - 1) * 7) : null;
    const m = weekSunday.getMonth();
    const y = weekSunday.getFullYear();
    const show =
      w === 0 ||
      !prevSunday ||
      prevSunday.getMonth() !== m ||
      prevSunday.getFullYear() !== y;
    if (show) {
      const label = weekSunday.toLocaleDateString(undefined, {
        month: "short",
        ...(y !== displayYear ? { year: "numeric" } : {}),
      });
      monthTicks.push({ weekIndex: w, label });
    }
  }

  const rangeLabel = `${windowStartDay.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })} – ${windowEndDay.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;

  return { numWeeks, cells, monthTicks, contributionsInRange, rangeLabel, startSunday };
}
