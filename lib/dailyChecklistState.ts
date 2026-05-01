/** GET /api/user/daily-checklist JSON body (shared with dashboard client). */
export type DailyChecklistApiResponse = {
  today: string;
  dailyDoseDone: boolean;
  subtopicRoutineDone: boolean;
  gyanPlusDone: boolean;
  instacueSessionDone: boolean;
  /** Refer & Earn “Challenge Yourself” style completion today — wire when product defines the rule. */
  challengeYourselfDone: boolean;
  gyanPlusProgress: {
    focusMs: number;
    savesToday: number;
    communityActionsToday: number;
  };
  /**
   * Unique card ids toward checklist (d): union of saves today + explicit reads today.
   * Same threshold as MIN_SAVED_CARDS_INSTACUE (32).
   */
  instacueCombinedCount: number;
  /** Distinct revision cards saved with `savedAt` in the client local day window (legacy path uses deck total count only). */
  savedRevisionCardCount: number;
  /** Card ids credited as read today via PATCH `instacue_read` / `instacue_read_batch` (subset used in union). */
  instacueReadCount: number;
  /** Total revision cards stored on the profile (not day-scoped). */
  savedRevisionCardsDeckTotal: number;
};

/**
 * Client + server: `profiles.daily_checklist_state` keyed by local calendar YYYY-MM-DD.
 */
export type DailyChecklistDayState = {
  instacueSessionAck?: boolean;
  /** Refer & Earn Challenge Yourself: finished a run today (win or loss — terminal only; quit excluded). */
  challengeYourselfAttempt?: boolean;
  /** Cumulative focused ms on Gyan++ (/doubts), capped per day server-side. */
  doubtsFocusMs?: number;
  /**
   * Deduped `subtopic_engagement` storage keys credited for checklist (b) today via Mark as complete.
   * Revoked when the learner hits Reset on that subtopic so the same completion cannot double-count.
   */
  subtopicBCompleteKeys?: string[];
  /**
   * Deduped InstaCue card ids credited as "read" this calendar day (PATCH instacue_read / batch).
   * Capped server-side (see MAX_INSTACUE_READ_IDS_PER_DAY).
   */
  instacueReadCardIds?: string[];
};

export type DailyChecklistStateMap = Record<string, DailyChecklistDayState>;

/** Max ids stored per day in `daily_checklist_state` for InstaCue reads. */
export const MAX_INSTACUE_READ_IDS_PER_DAY = 128;
/** Max chars per card id (InstaCue / revision bank ids). */
export const MAX_INSTACUE_CARD_ID_LEN = 128;

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function sanitizeInstacueCardId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim().slice(0, MAX_INSTACUE_CARD_ID_LEN);
  return t.length > 0 ? t : null;
}

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
    if (row.challengeYourselfAttempt === true) day.challengeYourselfAttempt = true;
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
    const rawReads = row.instacueReadCardIds;
    if (Array.isArray(rawReads)) {
      const ids = Array.from(
        new Set(
          rawReads
            .map((x) => sanitizeInstacueCardId(x))
            .filter((x): x is string => Boolean(x))
        )
      ).slice(0, MAX_INSTACUE_READ_IDS_PER_DAY);
      if (ids.length) day.instacueReadCardIds = ids;
    }
    if (
      day.instacueSessionAck ||
      day.challengeYourselfAttempt === true ||
      day.doubtsFocusMs != null ||
      (day.subtopicBCompleteKeys?.length ?? 0) > 0 ||
      (day.instacueReadCardIds?.length ?? 0) > 0
    ) {
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
  if (patch.challengeYourselfAttempt === true) nextDay.challengeYourselfAttempt = true;
  if (patch.instacueReadCardIds != null && patch.instacueReadCardIds.length > 0) {
    const fromPatch = patch.instacueReadCardIds
      .map((id) => sanitizeInstacueCardId(id))
      .filter((x): x is string => x != null);
    const merged = new Set<string>([...(prior.instacueReadCardIds ?? []), ...fromPatch]);
    nextDay.instacueReadCardIds = Array.from(merged).slice(0, MAX_INSTACUE_READ_IDS_PER_DAY);
  }
  if (patch.doubtsFocusMs != null && Number.isFinite(patch.doubtsFocusMs)) {
    const add = Math.max(0, Math.trunc(patch.doubtsFocusMs));
    const base =
      typeof prior.doubtsFocusMs === "number" && Number.isFinite(prior.doubtsFocusMs)
        ? prior.doubtsFocusMs
        : 0;
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
  const existing = new Set(
    (prior.subtopicBCompleteKeys ?? []).filter((x) => typeof x === "string")
  );
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

/** Merge InstaCue read card ids into `daily_checklist_state` for one day (dedupe + cap). */
export function appendInstacueReadCardIds(
  prev: DailyChecklistStateMap,
  dayKey: string,
  rawIds: unknown[]
): DailyChecklistStateMap {
  const ids = rawIds
    .map((x) => sanitizeInstacueCardId(x))
    .filter((x): x is string => Boolean(x));
  if (!ids.length) return prev;
  const prior = prev[dayKey] ?? {};
  const merged = new Set([...(prior.instacueReadCardIds ?? []), ...ids]);
  const arr = Array.from(merged).slice(0, MAX_INSTACUE_READ_IDS_PER_DAY);
  return {
    ...prev,
    [dayKey]: { ...prior, instacueReadCardIds: arr },
  };
}
