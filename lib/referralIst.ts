/**
 * IST calendar helpers for referral week (Monday 00:00 IST start, per Earn & Learn FAQ).
 * Uses Intl only (no date-fns-tz).
 */

const TZ = "Asia/Kolkata";

function istCalendarParts(d: Date): { y: number; m: number; day: number } {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
  const parts = f.formatToParts(d);
  let y = 0;
  let m = 0;
  let day = 0;
  for (const p of parts) {
    if (p.type === "year") y = Number(p.value);
    if (p.type === "month") m = Number(p.value);
    if (p.type === "day") day = Number(p.value);
  }
  return { y, m, day };
}

function istWeekdayShort(d: Date): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(d);
}

/** YYYY-MM-DD for the Monday of the IST week containing `instant`. */
export function getIstWeekMondayDateString(instant: Date = new Date()): string {
  let cursor = new Date(instant.getTime());
  for (let i = 0; i < 7; i++) {
    const w = istWeekdayShort(cursor);
    if (w === "Mon") {
      const { y, m, day } = istCalendarParts(cursor);
      const mm = String(m).padStart(2, "0");
      const dd = String(day).padStart(2, "0");
      return `${y}-${mm}-${dd}`;
    }
    cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
  }
  const { y, m, day } = istCalendarParts(instant);
  const mm = String(m).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}
