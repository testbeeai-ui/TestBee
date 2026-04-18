/** GET /api/user/daily-checklist JSON body (shared with dashboard client). */
export type DailyChecklistApiResponse = {
  today: string;
  dailyDoseDone: boolean;
  subtopicRoutineDone: boolean;
  gyanPlusDone: boolean;
  instacueSessionDone: boolean;
  gyanPlusProgress: {
    focusMs: number;
    savesToday: number;
    communityActionsToday: number;
  };
  /**
   * Cards counted toward checklist (d) vs MIN_SAVED_CARDS_INSTACUE.
   * After any card has `savedAt`, this is saves **today** (local day window); otherwise legacy = full deck size.
   */
  savedRevisionCardCount: number;
  /** Total revision cards stored on the profile (not day-scoped). */
  savedRevisionCardsDeckTotal: number;
};

/**
 * Client + server: `profiles.daily_checklist_state` keyed by local calendar YYYY-MM-DD.
 */
export type DailyChecklistDayState = {
  instacueSessionAck?: boolean;
  /** Cumulative focused ms on Gyan++ (/doubts), capped per day server-side. */
  doubtsFocusMs?: number;
  /**
   * Deduped `subtopic_engagement` storage keys credited for checklist (b) today via Mark as complete.
   * Revoked when the learner hits Reset on that subtopic so the same completion cannot double-count.
   */
  subtopicBCompleteKeys?: string[];
};

export type DailyChecklistStateMap = Record<string, DailyChecklistDayState>;

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function parseIsoDay(s: string | null): string | null {
  if (!s || typeof s !== "string") return null;
  const t = s.trim();
  if (!ISO_DAY.test(t)) return null;
  return t;
}

export function parseDailyChecklistState(raw: unknown): DailyChecklistStateMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: DailyChecklistStateMap = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!ISO_DAY.test(k) || !v || typeof v !== "object" || Array.isArray(v)) continue;
    const row = v as Record<string, unknown>;
    const day: DailyChecklistDayState = {};
    if (row.instacueSessionAck === true) day.instacueSessionAck = true;
    const dm = Number(row.doubtsFocusMs);
    if (Number.isFinite(dm) && dm > 0) day.doubtsFocusMs = Math.min(86_400_000, Math.trunc(dm));
    const rawKeys = row.subtopicBCompleteKeys;
    if (Array.isArray(rawKeys)) {
      const keys = rawKeys
        .filter((x): x is string => typeof x === "string")
        .map((x) => x.trim().slice(0, 800))
        .filter(Boolean);
      if (keys.length) day.subtopicBCompleteKeys = Array.from(new Set(keys)).slice(0, 100);
    }
    if (day.instacueSessionAck || day.doubtsFocusMs != null || (day.subtopicBCompleteKeys?.length ?? 0) > 0) {
      out[k] = day;
    }
  }
  return out;
}

export function mergeDayState(
  prev: DailyChecklistStateMap,
  dayKey: string,
  patch: Partial<DailyChecklistDayState>
): DailyChecklistStateMap {
  const prior = prev[dayKey] ?? {};
  const nextDay: DailyChecklistDayState = { ...prior };
  if (patch.instacueSessionAck === true) nextDay.instacueSessionAck = true;
  if (patch.doubtsFocusMs != null && Number.isFinite(patch.doubtsFocusMs)) {
    const add = Math.max(0, Math.trunc(patch.doubtsFocusMs));
    const base = typeof prior.doubtsFocusMs === "number" && Number.isFinite(prior.doubtsFocusMs) ? prior.doubtsFocusMs : 0;
    nextDay.doubtsFocusMs = Math.min(86_400_000, base + add);
  }
  return { ...prev, [dayKey]: nextDay };
}

const MAX_B_KEYS_PER_DAY = 100;
const MAX_ENGAGEMENT_KEY_LEN = 800;

/** Append one engagement storage key for checklist (b); no-op if already present or invalid. */
export function appendSubtopicBCompleteKey(
  prev: DailyChecklistStateMap,
  dayKey: string,
  engagementKey: string
): DailyChecklistStateMap {
  const k = engagementKey.trim().slice(0, MAX_ENGAGEMENT_KEY_LEN);
  if (!k || !k.includes("||")) return prev;
  const prior = prev[dayKey] ?? {};
  const existing = new Set((prior.subtopicBCompleteKeys ?? []).filter((x) => typeof x === "string"));
  if (existing.has(k)) return { ...prev, [dayKey]: { ...prior } };
  existing.add(k);
  const arr = Array.from(existing).slice(0, MAX_B_KEYS_PER_DAY);
  return { ...prev, [dayKey]: { ...prior, subtopicBCompleteKeys: arr } };
}

/** Remove key when learner resets Lessons/Progress for that subtopic. */
export function removeSubtopicBCompleteKey(
  prev: DailyChecklistStateMap,
  dayKey: string,
  engagementKey: string
): DailyChecklistStateMap {
  const k = engagementKey.trim().slice(0, MAX_ENGAGEMENT_KEY_LEN);
  if (!k) return prev;
  const prior = prev[dayKey] ?? {};
  const arr = (prior.subtopicBCompleteKeys ?? []).filter((x) => x !== k);
  const nextDay: DailyChecklistDayState = { ...prior };
  if (arr.length) nextDay.subtopicBCompleteKeys = arr;
  else delete nextDay.subtopicBCompleteKeys;
  return { ...prev, [dayKey]: nextDay };
}
