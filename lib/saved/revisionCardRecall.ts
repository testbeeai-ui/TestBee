import type { SavedRevisionCard } from "@/types";

export type RevisionRecallAction = "unsure" | "tomorrow" | "know_it";

/** Through 1:59 AM local, "Tomorrow" means this morning at 9 — not the next calendar day. */
const REVISION_LATE_NIGHT_GRACE_HOUR = 2;

function localNineAmMs(date: Date): number {
  const d = new Date(date);
  d.setHours(9, 0, 0, 0);
  return d.getTime();
}

/**
 * InstaCue / Memory Recall "Tomorrow" due time (local):
 * - 12:00 AM–1:59 AM → same calendar day 9:00 AM ("this morning" for night owls).
 * - 2:00 AM onward → next calendar day 9:00 AM.
 */
export function getRevisionTomorrowDueMs(nowMs: number): number {
  const d = new Date(nowMs);
  if (d.getHours() < REVISION_LATE_NIGHT_GRACE_HOUR) {
    return localNineAmMs(d);
  }
  const next = new Date(d);
  next.setDate(d.getDate() + 1);
  return localNineAmMs(next);
}

export type RevisionCardStatus = NonNullable<SavedRevisionCard["status"]>;

function parseReviewAtMs(reviewAt: string | undefined): number | null {
  if (!reviewAt) return null;
  const ms = Date.parse(reviewAt);
  return Number.isFinite(ms) ? ms : null;
}

/** Effective status after auto-promoting due tomorrow cards to new. */
export function getEffectiveRevisionStatus(
  card: Pick<SavedRevisionCard, "status" | "reviewAt">,
  nowMs: number = Date.now()
): RevisionCardStatus {
  const status = card.status ?? "new";
  if (status !== "tomorrow") return status;
  const dueMs = parseReviewAtMs(card.reviewAt);
  if (dueMs == null || nowMs >= dueMs) return "new";
  return "tomorrow";
}

/** Human-readable due time for Tomorrow toasts (local 9 AM). */
export function formatRevisionTomorrowDueLabel(
  reviewAtIso: string,
  nowMs: number = Date.now()
): string {
  const due = new Date(reviewAtIso);
  const now = new Date(nowMs);
  const timeStr = due.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const sameCalendarDay =
    due.getFullYear() === now.getFullYear() &&
    due.getMonth() === now.getMonth() &&
    due.getDate() === now.getDate();
  if (sameCalendarDay) return `today at ${timeStr}`;

  const nextDay = new Date(now);
  nextDay.setDate(now.getDate() + 1);
  const isNextCalendarDay =
    due.getFullYear() === nextDay.getFullYear() &&
    due.getMonth() === nextDay.getMonth() &&
    due.getDate() === nextDay.getDate();
  if (isNextCalendarDay) return `tomorrow at ${timeStr}`;

  return due.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function getRevisionRecallFeedback(
  action: RevisionRecallAction,
  opts?: { reviewAt?: string; nowMs?: number }
): { title: string; description: string } {
  switch (action) {
    case "tomorrow": {
      const when = opts?.reviewAt
        ? formatRevisionTomorrowDueLabel(opts.reviewAt, opts.nowMs)
        : "tomorrow at 9:00 AM";
      return {
        title: "See you tomorrow",
        description: `This card will come back ${when}.`,
      };
    }
    case "know_it":
      return {
        title: "Marked as known",
        description: "You won't see this card in Memory Recall again.",
      };
    case "unsure":
      return {
        title: "Saved as Unsure",
        description: "Review it in Revision → InstaCue → Unsure.",
      };
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}

export function applyRevisionRecallAction(
  card: SavedRevisionCard,
  action: RevisionRecallAction,
  nowMs: number = Date.now()
): SavedRevisionCard {
  switch (action) {
    case "know_it":
      return { ...card, status: "know_it", reviewAt: undefined };
    case "tomorrow":
      return {
        ...card,
        status: "tomorrow",
        reviewAt: new Date(getRevisionTomorrowDueMs(nowMs)).toISOString(),
      };
    case "unsure":
      return { ...card, status: "unsure", reviewAt: undefined };
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}

/** Promote tomorrow cards whose reviewAt has passed to new. */
export function promoteDueTomorrowCards(
  cards: SavedRevisionCard[],
  nowMs: number = Date.now()
): SavedRevisionCard[] {
  return cards.map((card) => {
    if (getEffectiveRevisionStatus(card, nowMs) !== "new" || card.status !== "tomorrow") {
      return card;
    }
    return { ...card, status: "new", reviewAt: undefined };
  });
}

/** Dashboard Memory Recall: new and due tomorrow only (not unsure, know_it, or future tomorrow). */
export function isInMemoryRecallQueue(
  card: SavedRevisionCard,
  nowMs: number = Date.now()
): boolean {
  const effective = getEffectiveRevisionStatus(card, nowMs);
  return effective === "new";
}

/** Revision player study deck: everything except know_it (includes future tomorrow). */
export function isInRevisionStudyDeck(
  card: SavedRevisionCard,
  _nowMs: number = Date.now()
): boolean {
  return card.status !== "know_it";
}

/** Future-scheduled tomorrow cards (Tomorrow tab only). */
export function isInTomorrowTab(
  card: SavedRevisionCard,
  nowMs: number = Date.now()
): boolean {
  if (card.status !== "tomorrow") return false;
  const dueMs = parseReviewAtMs(card.reviewAt);
  if (dueMs == null) return false;
  return nowMs < dueMs;
}

/** Count of cards scheduled for tomorrow but not yet due (Due Tomorrow badge). */
export function countScheduledTomorrow(
  cards: SavedRevisionCard[],
  nowMs: number = Date.now()
): number {
  return cards.filter((c) => isInTomorrowTab(c, nowMs)).length;
}

/** Cards marked unsure - revision player only (not on dashboard Memory Recall). */
export function countUnsureInRevisionDeck(cards: SavedRevisionCard[]): number {
  return cards.filter((c) => c.status === "unsure").length;
}

function recallPriority(status: SavedRevisionCard["status"]): number {
  switch (status) {
    case "know_it":
      return 4;
    case "tomorrow":
      return 3;
    case "unsure":
      return 2;
    case "new":
      return 1;
    default:
      return 0;
  }
}

/** Merge one local + server row without letting stale server recall state win. */
export function mergeRevisionCardPair(
  local: SavedRevisionCard,
  server: SavedRevisionCard
): SavedRevisionCard {
  const localP = recallPriority(local.status);
  const serverP = recallPriority(server.status);
  const base = (local.savedAt ?? "") >= (server.savedAt ?? "") ? local : server;
  let recall = local;
  if (serverP > localP) {
    recall = server;
  } else if (serverP === localP && (server.savedAt ?? "") > (local.savedAt ?? "")) {
    recall = server;
  }
  const status = recall.status ?? "new";
  const reviewAt =
    status === "tomorrow"
      ? recall.reviewAt ?? local.reviewAt ?? server.reviewAt
      : undefined;
  return {
    ...base,
    status,
    reviewAt,
  };
}

/** Merge local + server revision banks (recall-aware), then fingerprint-dedupe. */
export function mergeRevisionCards(
  local: SavedRevisionCard[],
  server: SavedRevisionCard[]
): SavedRevisionCard[] {
  const serverById = new Map(server.map((c) => [c.id, c]));
  const localById = new Map(local.map((c) => [c.id, c]));
  const ids = new Set([...localById.keys(), ...serverById.keys()]);
  const merged: SavedRevisionCard[] = [];
  for (const id of ids) {
    const localCard = localById.get(id);
    const serverCard = serverById.get(id);
    if (localCard && serverCard) {
      merged.push(mergeRevisionCardPair(localCard, serverCard));
    } else {
      merged.push((localCard ?? serverCard)!);
    }
  }
  return merged;
}
