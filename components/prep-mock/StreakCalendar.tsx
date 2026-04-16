'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  fetchPrepCalendarMonth,
  type PrepCalendarDayRow,
  type PrepCalendarSummary,
} from '@/lib/prepCalendarClient';

type DayTotals = {
  class: number;
  revision: number;
  mock: number;
  doubt: number;
};

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const DOT_CLASS: Record<keyof DayTotals, string> = {
  class: 'bg-green-500',
  revision: 'bg-blue-500',
  mock: 'bg-red-500',
  doubt: 'bg-gray-400',
};

function cap(n: number, max = 6) {
  return Math.min(Math.max(n, 0), max);
}

/** Flatten counts into a list of dot colors (order: class → revision → mock → doubt). */
function dotsForDay(t: DayTotals): (keyof DayTotals)[] {
  const out: (keyof DayTotals)[] = [];
  (['class', 'revision', 'mock', 'doubt'] as const).forEach((k) => {
    const n = cap(t[k]);
    for (let i = 0; i < n; i++) out.push(k);
  });
  return out;
}

interface StreakCalendarProps {
  /** When set, loads month rows from Supabase via API. */
  userId?: string | null;
  accessToken?: string | null;
  /** Bump to refetch after logging new activity (e.g. mock submitted). */
  refreshKey?: number;
}

export default function StreakCalendar({ userId, accessToken, refreshKey = 0 }: StreakCalendarProps) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [rows, setRows] = useState<PrepCalendarDayRow[]>([]);
  const [summary, setSummary] = useState<PrepCalendarSummary>({ streak: 0, totalActiveDays: 0 });
  const [loading, setLoading] = useState(false);

  const loadMonth = useCallback(async () => {
    if (!userId) {
      setRows([]);
      setSummary({ streak: 0, totalActiveDays: 0 });
      return;
    }
    setLoading(true);
    try {
      const { days, summary: s } = await fetchPrepCalendarMonth(
        accessToken ?? undefined,
        viewYear,
        viewMonth + 1
      );
      setRows(days);
      setSummary(s ?? { streak: 0, totalActiveDays: 0 });
    } finally {
      setLoading(false);
    }
  }, [userId, accessToken, viewYear, viewMonth, refreshKey]);

  useEffect(() => {
    void loadMonth();
  }, [loadMonth, refreshKey]);

  const byDay = useMemo(() => {
    const m = new Map<string, DayTotals>();
    for (const r of rows) {
      m.set(r.day, {
        class: r.class_count,
        revision: r.revision_count,
        mock: r.mock_count,
        doubt: r.doubt_count,
      });
    }
    return m;
  }, [rows]);

  const calendarCells = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [viewYear, viewMonth]);

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else setViewMonth((m) => m + 1);
  };

  const isToday = (d: number) =>
    d === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();

  const dayKey = (d: number) => {
    const mm = String(viewMonth + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    return `${viewYear}-${mm}-${dd}`;
  };

  return (
    <section id="calendar" className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold text-foreground text-sm flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-primary" />
          Calendar
        </h3>
        <span className="text-xs font-bold text-[#1D9E75] cursor-pointer hover:underline opacity-80" title="Coming soon">
          AI-optimize schedule
        </span>
      </div>

      <div className="edu-card rounded-xl border border-border/50 p-4">
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={prevMonth}
            className="w-8 h-8 rounded-lg border border-primary/30 bg-primary/[0.07] text-foreground shadow-sm ring-1 ring-primary/10 hover:bg-primary/12 hover:border-primary/45 flex items-center justify-center transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-4 h-4 text-primary" />
          </button>
          <span className="text-sm font-bold text-foreground">
            {MONTHS[viewMonth]} {viewYear}
          </span>
          <button
            type="button"
            onClick={nextMonth}
            className="w-8 h-8 rounded-lg border border-primary/30 bg-primary/[0.07] text-foreground shadow-sm ring-1 ring-primary/10 hover:bg-primary/12 hover:border-primary/45 flex items-center justify-center transition-colors"
            aria-label="Next month"
          >
            <ChevronRight className="w-4 h-4 text-primary" />
          </button>
        </div>

        <div className="grid grid-cols-7 mb-1">
          {DAYS.map((d) => (
            <div key={d} className="text-center text-[11px] font-bold text-muted-foreground py-1">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-y-1">
          {calendarCells.map((day, i) => {
            if (day === null) return <div key={`empty-${i}`} />;
            const key = dayKey(day);
            const totals: DayTotals = byDay.get(key) ?? { class: 0, revision: 0, mock: 0, doubt: 0 };
            const dots = dotsForDay(totals);
            const todayCell = isToday(day);
            const hasDots = dots.length > 0;
            return (
              <div
                key={day}
                className={`flex flex-col items-center justify-center rounded-lg text-[11px] font-medium min-h-[2.75rem] py-1 mx-0.5 transition-colors gap-0.5
                  ${todayCell ? 'bg-primary text-primary-foreground font-extrabold ring-1 ring-primary/40' : 'text-foreground hover:bg-muted/60'}
                  ${!todayCell && hasDots ? 'bg-muted/50 border border-border/60' : ''}`}
              >
                <span>{day}</span>
                {hasDots ? (
                  <span className="flex flex-wrap justify-center gap-0.5 max-w-[2.75rem]">
                    {dots.map((kind, di) => (
                      <span
                        key={`${key}-${di}`}
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${DOT_CLASS[kind]}`}
                        title={kind}
                      />
                    ))}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-border/50">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Class
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> Revision
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Mock
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" /> Doubt
          </span>
          {loading ? <span className="text-[10px] text-muted-foreground ml-auto">Updating…</span> : null}
        </div>

        <div className="text-center mt-2">
          <span className="text-sm font-bold text-foreground">{summary.streak} day streak</span>
          <span className="text-xs text-muted-foreground ml-1.5">· {summary.totalActiveDays} active days</span>
        </div>
      </div>
    </section>
  );
}
