/** Calendar-day difference vs local today (midnight-normalized). */
export function daysFromTodayLocal(isoDate: string): number {
  const target = new Date(`${isoDate}T12:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  if (Number.isNaN(target.getTime())) return NaN;
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

/** DD-Mon-YYYY format (e.g. 15-May-2026). */
export function formatDdMonYyyy(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const day = d.getDate();
  const mon = months[d.getMonth()];
  const yr = d.getFullYear();
  return `${day}-${mon}-${yr}`;
}

export function formatRelativeNewsTime(iso: string): string {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return "";
  const diff = Math.max(0, Date.now() - ts);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  return `${w}w ago`;
}
