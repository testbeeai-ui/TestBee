/** 12-hour clock parts for compact UI (30-minute granularity). */
export type WallTimeParts = {
  hour12: number;
  minute: 0 | 30;
  isPm: boolean;
};

/** Parse strict `HH:mm` (24h) into 12h display parts; requires minute 00 or 30. */
export function hhmmToWallParts(hhmm: string): WallTimeParts | null {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h24 = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h24) || h24 < 0 || h24 > 23) return null;
  if (min !== 0 && min !== 30) return null;
  const isPm = h24 >= 12;
  const hour12 = h24 === 0 || h24 === 12 ? 12 : h24 % 12;
  return { hour12, minute: min === 30 ? 30 : 0, isPm };
}

export function wallPartsToHhmm(p: WallTimeParts): string {
  let h24: number;
  if (!p.isPm) {
    h24 = p.hour12 === 12 ? 0 : p.hour12;
  } else {
    h24 = p.hour12 === 12 ? 12 : p.hour12 + 12;
  }
  const mm = p.minute === 30 ? 30 : 0;
  return `${String(h24).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/**
 * Snap "HH:mm" (24h) to the nearest 30-minute boundary for section / calendar scheduling.
 */
export function snapTimeToHalfHourSlot(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const m = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
  if (!m) return trimmed;
  let h = Number(m[1]);
  let min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return trimmed;
  h = Math.max(0, Math.min(23, Math.floor(h)));
  min = Math.max(0, Math.min(59, Math.floor(min)));
  const total = h * 60 + min;
  const snapped = Math.round(total / 30) * 30;
  const nh = Math.floor(snapped / 60) % 24;
  const nm = snapped % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}
