import type { SavedRevisionCard } from "@/types";
import type { InstaCueCard } from "@/data/instaCueCards";

type RevisionCardLike = Pick<
  SavedRevisionCard,
  | "id"
  | "subject"
  | "classLevel"
  | "topic"
  | "subtopicName"
  | "level"
  | "type"
  | "frontContent"
  | "backContent"
>;

function hashHex(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = (h * 33) ^ input.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}

/** Stable identity for dedupe — same card content in the same lesson scope. */
export function revisionCardFingerprint(card: RevisionCardLike): string {
  return [
    card.subject,
    String(card.classLevel),
    card.topic.trim().toLowerCase(),
    card.subtopicName.trim().toLowerCase(),
    (card.level ?? "").trim().toLowerCase(),
    card.type,
    card.frontContent.trim(),
    card.backContent.trim(),
  ].join("\u001f");
}

/**
 * Persisted id for Revision Bank.
 * AI deck ids (`ai-…-${idx}`) change when the deck is regenerated — use a content hash instead.
 */
export function buildRevisionCardSaveId(card: RevisionCardLike): string {
  if (card.id.startsWith("user-")) return card.id;
  if (card.id.startsWith("ai-")) {
    return `rev-${hashHex(revisionCardFingerprint(card))}`;
  }
  return card.id;
}

export function normalizeRevisionCardForSave(
  card: InstaCueCard | SavedRevisionCard
): SavedRevisionCard {
  return {
    id: buildRevisionCardSaveId(card),
    type: card.type,
    frontContent: card.frontContent,
    backContent: card.backContent,
    subtopicName: card.subtopicName,
    topic: card.topic,
    subject: card.subject,
    classLevel: card.classLevel,
    level: card.level,
    board: "board" in card ? card.board : undefined,
    sectionIndex: "sectionIndex" in card ? card.sectionIndex : undefined,
    status: "status" in card && card.status ? card.status : "new",
    reviewAt: "reviewAt" in card ? card.reviewAt : undefined,
    savedAt: ("savedAt" in card && card.savedAt) || new Date().toISOString(),
  };
}

export function isRevisionCardSaved(
  savedCards: SavedRevisionCard[],
  card: RevisionCardLike
): boolean {
  const saveId = buildRevisionCardSaveId(card);
  const fp = revisionCardFingerprint(card);
  return savedCards.some(
    (c) => c.id === saveId || c.id === card.id || revisionCardFingerprint(c) === fp
  );
}

export function findSavedRevisionCardId(
  savedCards: SavedRevisionCard[],
  card: RevisionCardLike
): string | null {
  const saveId = buildRevisionCardSaveId(card);
  const fp = revisionCardFingerprint(card);
  const hit =
    savedCards.find((c) => c.id === saveId) ??
    savedCards.find((c) => c.id === card.id) ??
    savedCards.find((c) => revisionCardFingerprint(c) === fp);
  return hit?.id ?? null;
}

/** Keep one row per save id; on fingerprint clash keep the newest savedAt. */
export function dedupeRevisionCards(cards: SavedRevisionCard[]): SavedRevisionCard[] {
  const byId = new Map<string, SavedRevisionCard>();
  for (const card of cards) {
    const existing = byId.get(card.id);
    if (!existing) {
      byId.set(card.id, card);
      continue;
    }
    const existingAt = existing.savedAt ?? "";
    const nextAt = card.savedAt ?? "";
    if (nextAt >= existingAt) byId.set(card.id, card);
  }

  const byFingerprint = new Map<string, SavedRevisionCard>();
  for (const card of byId.values()) {
    const fp = revisionCardFingerprint(card);
    const existing = byFingerprint.get(fp);
    if (!existing) {
      byFingerprint.set(fp, card);
      continue;
    }
    const existingAt = existing.savedAt ?? "";
    const nextAt = card.savedAt ?? "";
    if (nextAt >= existingAt) byFingerprint.set(fp, card);
  }

  return [...byFingerprint.values()];
}
