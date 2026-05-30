"use client";

import { hhmmToWallParts, wallPartsToHhmm, type WallTimeParts } from "@/lib/teacherPortal/timeHHmm";

type WallTimeSelectsProps = {
  value: string;
  onChange: (hhmm: string) => void;
  disabled?: boolean;
  className?: string;
};

/**
 * Compact 12h time entry (30-minute steps) — avoids huge native `<input type="time">` pickers on laptops.
 */
export default function WallTimeSelects({
  value,
  onChange,
  disabled,
  className = "",
}: WallTimeSelectsProps) {
  const parsed = hhmmToWallParts(value.trim());

  const sel =
    "h-9 min-h-[36px] w-full min-w-0 rounded-lg border border-white/15 bg-[#070b17] px-1 text-center text-[12px] font-medium outline-none focus:border-emerald-400 disabled:opacity-50 sm:text-sm";

  const apply = (partial: Partial<WallTimeParts>) => {
    if (!parsed && partial.hour12 != null) {
      onChange(
        wallPartsToHhmm({
          hour12: partial.hour12,
          minute: partial.minute ?? 0,
          isPm: partial.isPm ?? false,
        })
      );
      return;
    }
    if (!parsed) return;
    onChange(wallPartsToHhmm({ ...parsed, ...partial }));
  };

  return (
    <div className={`flex min-w-0 items-stretch gap-1 ${className}`}>
      <select
        aria-label="Hour"
        disabled={disabled}
        value={parsed ? String(parsed.hour12) : ""}
        onChange={(e) => {
          const v = e.target.value;
          if (!v) {
            onChange("");
            return;
          }
          apply({ hour12: Number(v) });
        }}
        className={`${sel} flex-[1.15]`}
      >
        <option value="">Hr</option>
        {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
          <option key={h} value={String(h)}>
            {h}
          </option>
        ))}
      </select>
      <select
        aria-label="Minute"
        disabled={disabled || !parsed}
        value={parsed ? String(parsed.minute) : ""}
        onChange={(e) => {
          const raw = e.target.value;
          if (!parsed || raw === "") return;
          apply({ minute: raw === "30" ? 30 : 0 });
        }}
        className={`${sel} flex-[0.95]`}
      >
        <option value="">Min</option>
        <option value="0">00</option>
        <option value="30">30</option>
      </select>
      <select
        aria-label="AM or PM"
        disabled={disabled || !parsed}
        value={parsed ? (parsed.isPm ? "pm" : "am") : ""}
        onChange={(e) => {
          const raw = e.target.value;
          if (!parsed || (raw !== "am" && raw !== "pm")) return;
          apply({ isPm: raw === "pm" });
        }}
        className={`${sel} flex-[1]`}
      >
        <option value="">—</option>
        <option value="am">AM</option>
        <option value="pm">PM</option>
      </select>
    </div>
  );
}
