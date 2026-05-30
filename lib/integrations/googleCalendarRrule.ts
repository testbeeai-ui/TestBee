/** UI weekday labels → RFC5545 BYDAY tokens */
const DAY_MAP: Record<string, string> = {
  Mon: "MO",
  Tue: "TU",
  Wed: "WE",
  Thu: "TH",
  Fri: "FR",
  Sat: "SA",
  Sun: "SU",
};

export function repeatLabelsToByDay(repeatDays: string[]): string | null {
  const codes = repeatDays.map((d) => DAY_MAP[d.trim()]).filter((c): c is string => Boolean(c));
  if (codes.length === 0) return null;
  return [...new Set(codes)].join(",");
}

/**
 * Build RRULE for weekly recurrence on selected weekdays.
 * - No repeat days → null (caller should create a single instance, no recurrence[]).
 * - Optional untilDate: `YYYY-MM-DD` → UNTIL end of that UTC calendar day.
 */
export function buildWeeklyRRule(input: {
  repeatDays: string[];
  /** Optional inclusive last occurrence day (date-only string). */
  untilDate?: string | null;
  /** Optional fixed number of occurrences (including first). */
  count?: number | null;
}): string | null {
  const byday = repeatLabelsToByDay(input.repeatDays);
  if (!byday) return null;
  let r = `RRULE:FREQ=WEEKLY;BYDAY=${byday}`;
  if (input.count != null && input.count > 0) {
    r += `;COUNT=${Math.floor(input.count)}`;
    return r;
  }
  if (input.untilDate?.trim()) {
    const [y, m, d] = input.untilDate
      .trim()
      .split("-")
      .map((x) => Number(x));
    if (!y || !m || !d) return r;
    r += `;UNTIL=${String(y)}${String(m).padStart(2, "0")}${String(d).padStart(2, "0")}T235959Z`;
  }
  return r;
}
