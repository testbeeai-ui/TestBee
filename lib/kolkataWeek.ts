/**
 * Calendar week (Mon 00:00 – Sun 23:59:59.999) in Asia/Kolkata, as UTC ms bounds for ISO timestamp comparisons.
 */
export function kolkataWeekRangeMs(reference: Date = new Date()): {
  startMs: number;
  endMs: number;
} {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(reference);
  const [yStr, mStr, dStr] = ymd.split("-");
  let y = Number(yStr);
  let m = Number(mStr);
  let d = Number(dStr);
  const wdStr = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
  }).format(reference);
  const wdMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const wd = wdMap[wdStr] ?? 1;
  const mondayDelta = wd === 0 ? -6 : 1 - wd;
  const mondayUtc = new Date(Date.UTC(y, m - 1, d + mondayDelta));
  y = mondayUtc.getUTCFullYear();
  m = mondayUtc.getUTCMonth() + 1;
  d = mondayUtc.getUTCDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  const startMs = Date.parse(`${y}-${pad(m)}-${pad(d)}T00:00:00+05:30`);
  const endMs = startMs + 7 * 24 * 60 * 60 * 1000 - 1;
  return { startMs, endMs };
}
