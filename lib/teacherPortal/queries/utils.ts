import type { Json } from "@/integrations/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type DbClient = SupabaseClient<Database>;

/** PostgREST commonly caps at 1000 rows; paginate so nudge "this week" sees all assignments. */
export const TEACHER_PORTAL_POSTS_PAGE_SIZE = 1000;

export function ensureError(err: unknown): Error {
  if (err instanceof Error) return err;
  if (typeof err === "object" && err !== null && "message" in err) {
    const m = (err as { message: unknown }).message;
    if (typeof m === "string" && m.trim()) return new Error(m.trim());
  }
  if (typeof err === "string" && err.trim()) return new Error(err.trim());
  return new Error("Request failed");
}

export function normalizeIndianPhone(raw: string | null | undefined): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  const core = digits.startsWith("91") && digits.length >= 12 ? digits.slice(2, 12) : digits.slice(0, 10);
  return core.length === 10 ? `+91 ${core}` : "";
}

export function isValidIndianPhone(raw: string | null | undefined): boolean {
  return normalizeIndianPhone(raw).length > 0;
}

export function hasValue(raw: string | null | undefined): boolean {
  return Boolean(raw && raw.trim());
}

export function hasIdentityDocs(input: {
  aadhar_photo_url?: string | null;
  aadhar_share_link?: string | null;
  institute_certificate_photo_url?: string | null;
  institute_certificate_share_link?: string | null;
}): boolean {
  return (
    (hasValue(input.aadhar_photo_url) || hasValue(input.aadhar_share_link)) &&
    (hasValue(input.institute_certificate_photo_url) || hasValue(input.institute_certificate_share_link))
  );
}

const JOIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function randomJoinCode(): string {
  const c = globalThis.crypto;
  if (c?.getRandomValues) {
    const bytes = new Uint8Array(6);
    c.getRandomValues(bytes);
    let s = "";
    for (let i = 0; i < 6; i++) s += JOIN_CODE_ALPHABET[bytes[i]! % JOIN_CODE_ALPHABET.length];
    return s;
  }
  return Array.from(
    { length: 6 },
    () => JOIN_CODE_ALPHABET[Math.floor(Math.random() * JOIN_CODE_ALPHABET.length)]
  ).join("");
}

export function asObject(input: Json | null | undefined): Record<string, Json> {
  if (input && typeof input === "object" && !Array.isArray(input)) {
    return input as Record<string, Json>;
  }
  return {};
}

export function asStringArray(input: Json | undefined): string[] {
  return Array.isArray(input)
    ? input.filter((item): item is string => typeof item === "string")
    : [];
}

export function formatSessionLabel(iso: string | null): string {
  if (!iso) return "No session scheduled";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "No session scheduled";
  const weekday = date.toLocaleDateString("en-US", { weekday: "short" });
  const day = date.toLocaleDateString("en-US", { day: "2-digit", month: "short" });
  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${weekday} ${day} · ${time}`;
}

export function normalizeScheduleYmd(raw: string): string | null {
  const date = raw.trim();
  if (!date) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(date);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

export function localDateFromYmdAndTime(ymd: string, timeStr: string): Date | null {
  const tm = timeStr.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!tm) return null;
  const hh = String(tm[1]).padStart(2, "0");
  const mm = tm[2];
  const d = new Date(`${ymd}T${hh}:${mm}:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export type SectionScheduleInferInput = {
  schedule_date: string | null;
  schedule_time: string | null;
  duration_minutes: unknown;
  repeat_days: unknown;
  schedule_end_date: string | null;
};

export type InferredCardSession = {
  iso: string;
  durationMinutes: number;
  sectionId: string;
  sectionName: string;
  meetLink: string | null;
};

/** Next occurrence from stored section schedule when live_sessions rows are missing or stale. */
export function inferNextOccurrenceFromSectionSchedule(
  s: SectionScheduleInferInput,
  nowMs: number
): { iso: string; durationMinutes: number } | null {
  const dateRaw = typeof s.schedule_date === "string" ? s.schedule_date.trim() : "";
  const timeRaw = typeof s.schedule_time === "string" ? s.schedule_time.trim() : "";
  if (!dateRaw || !timeRaw) return null;
  const anchorYmd = normalizeScheduleYmd(dateRaw);
  if (!anchorYmd) return null;
  const dur =
    typeof s.duration_minutes === "number" &&
    Number.isFinite(s.duration_minutes) &&
    s.duration_minutes > 0
      ? s.duration_minutes
      : 60;
  const repeat = Array.isArray(s.repeat_days)
    ? (s.repeat_days as unknown[]).map((x) => String(x).trim()).filter(Boolean)
    : [];
  const endYmdRaw =
    typeof s.schedule_end_date === "string" && s.schedule_end_date.trim()
      ? normalizeScheduleYmd(s.schedule_end_date.trim())
      : null;
  const endDayMs = endYmdRaw
    ? (() => {
        const endMidnight = localDateFromYmdAndTime(endYmdRaw, "23:59");
        return endMidnight ? endMidnight.getTime() : null;
      })()
    : null;

  if (!repeat.length) {
    const start = localDateFromYmdAndTime(anchorYmd, timeRaw);
    if (!start) return null;
    const endT = start.getTime() + dur * 60 * 1000;
    if (endT < nowMs) return null;
    if (endDayMs != null && start.getTime() > endDayMs) return null;
    return { iso: start.toISOString(), durationMinutes: dur };
  }

  const now = new Date(nowMs);
  const scanStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (let add = 0; add < 120; add++) {
    const cal = new Date(scanStart);
    cal.setDate(scanStart.getDate() + add);
    const label = cal.toLocaleDateString("en-US", { weekday: "short" });
    if (!repeat.includes(label)) continue;
    const ymd2 = `${cal.getFullYear()}-${String(cal.getMonth() + 1).padStart(2, "0")}-${String(cal.getDate()).padStart(2, "0")}`;
    const cand = localDateFromYmdAndTime(ymd2, timeRaw);
    if (!cand) continue;
    const ms = cand.getTime();
    if (ms < nowMs) continue;
    if (endDayMs != null && ms > endDayMs) continue;
    return { iso: cand.toISOString(), durationMinutes: dur };
  }
  return null;
}

export function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function startOfWeekIso(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString();
}

export const SUBJECTS = new Set(["physics", "chemistry", "math"]);
