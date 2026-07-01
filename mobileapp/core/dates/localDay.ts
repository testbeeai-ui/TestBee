export function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDaysLocal(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function localDayKeyFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function localDayBoundsIso(now = new Date()): {
  today: string;
  dayStart: string;
  dayEnd: string;
} {
  const start = startOfLocalDay(now);
  const end = addDaysLocal(start, 1);
  return {
    today: localDayKeyFromDate(start),
    dayStart: start.toISOString(),
    dayEnd: end.toISOString(),
  };
}
