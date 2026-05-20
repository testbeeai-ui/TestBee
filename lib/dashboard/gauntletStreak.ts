export function prevDay(d: string): string {
  const dt = new Date(d);
  dt.setDate(dt.getDate() - 1);
  return dt.toISOString().slice(0, 10);
}

/** Consecutive calendar days with at least one gauntlet play, anchored to today or yesterday (UTC date strings). */
export function computeStreakDays(dates: string[]): number {
  if (dates.length === 0) return 0;
  const today = new Date().toISOString().slice(0, 10);
  const sorted = [...new Set(dates)].sort((a, b) => b.localeCompare(a));
  const mostRecent = sorted[0];
  const oneDayAgo = prevDay(today);
  if (mostRecent !== today && mostRecent !== oneDayAgo) return 0;
  let count = 0;
  let expect = mostRecent;
  for (const d of sorted) {
    if (d !== expect) break;
    count++;
    expect = prevDay(expect);
  }
  return count;
}
