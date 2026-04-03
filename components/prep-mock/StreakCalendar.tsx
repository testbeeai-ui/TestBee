'use client';

import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

interface StreakCalendarProps {
  activityDates: Date[];
}

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function StreakCalendar({ activityDates }: StreakCalendarProps) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  // Normalise activity dates to midnight strings for fast lookup
  const activeSet = useMemo(() => {
    const s = new Set<string>();
    activityDates.forEach((d) => {
      const norm = new Date(d);
      norm.setHours(0, 0, 0, 0);
      s.add(norm.toDateString());
    });
    return s;
  }, [activityDates]);

  const streakCount = useMemo(() => {
    if (activeSet.size === 0) return 0;
    let streak = 0;
    const check = new Date(today);
    check.setHours(0, 0, 0, 0);
    while (activeSet.has(check.toDateString())) {
      streak++;
      check.setDate(check.getDate() - 1);
    }
    return streak;
  }, [activeSet]);

  // Build calendar grid for the viewed month
  const calendarCells = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    // Pad to complete last row
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [viewYear, viewMonth]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  };

  const isToday = (d: number) =>
    d === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();

  const isActive = (d: number) => {
    const check = new Date(viewYear, viewMonth, d);
    check.setHours(0, 0, 0, 0);
    return activeSet.has(check.toDateString());
  };

  return (
    <section id="calendar" className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold text-foreground text-sm flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-primary" />
          AI Calendar
        </h3>
        <span className="text-xs font-bold text-[#1D9E75] cursor-pointer hover:underline">
          AI-optimize schedule
        </span>
      </div>

      <div className="edu-card rounded-xl border border-border/50 p-4">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-3">
          <button onClick={prevMonth} className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center transition-colors">
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <span className="text-sm font-bold text-foreground">
            {MONTHS[viewMonth]} {viewYear}
          </span>
          <button onClick={nextMonth} className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center transition-colors">
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {DAYS.map((d) => (
            <div key={d} className="text-center text-[11px] font-bold text-muted-foreground py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Date grid */}
        <div className="grid grid-cols-7 gap-y-1">
          {calendarCells.map((day, i) => {
            if (day === null) return <div key={`empty-${i}`} />;
            const active = isActive(day);
            const todayCell = isToday(day);
            return (
              <div
                key={day}
                className={`flex items-center justify-center rounded-lg text-xs font-medium h-8 mx-0.5 transition-colors
                  ${todayCell
                    ? 'bg-primary text-primary-foreground font-extrabold'
                    : active
                      ? 'bg-[#1D9E75]/20 text-[#085041] font-bold'
                      : 'text-foreground hover:bg-muted/60'
                  }`}
              >
                {day}
              </div>
            );
          })}
        </div>

        {/* Legend */}
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
        </div>

        <div className="text-center mt-2">
          <span className="text-sm font-bold text-foreground">{streakCount} day streak</span>
          <span className="text-xs text-muted-foreground ml-1.5">· {activeSet.size} active days</span>
        </div>
      </div>
    </section>
  );
}
