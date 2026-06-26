import type { SavedRevisionCard } from "@/types";

const RECALL_STATUSES = new Set(["unsure", "tomorrow", "know_it", "new"]);

function asRevisionStatus(value: unknown): SavedRevisionCard["status"] | undefined {
  if (typeof value !== "string") return undefined;
  return RECALL_STATUSES.has(value) ? (value as SavedRevisionCard["status"]) : undefined;
}

/** Strip indexed recall fields from JSONB `data` on write. */
export function slimRevisionCardStorage(card: SavedRevisionCard): {
  data: Record<string, unknown>;
  status: string | null;
  saved_at: string | null;
  review_at: string | null;
} {
  const { status, reviewAt, savedAt, ...rest } = card;
  return {
    data: { ...rest },
    status: status ?? null,
    saved_at: savedAt ?? null,
    review_at: reviewAt ?? null,
  };
}

export type SavedRevisionItemRow = {
  data: unknown;
  status?: string | null;
  saved_at?: string | null;
  review_at?: string | null;
};

/** Merge indexed columns back into the client card shape (backward compatible with fat JSON rows). */
export function hydrateRevisionCardFromSavedItemRow(row: SavedRevisionItemRow): SavedRevisionCard {
  const raw =
    row.data && typeof row.data === "object" && !Array.isArray(row.data)
      ? (row.data as Record<string, unknown>)
      : {};
  const card = { ...raw } as unknown as SavedRevisionCard;

  const status = asRevisionStatus(row.status) ?? asRevisionStatus(raw.status);
  const savedAt = row.saved_at ?? (typeof raw.savedAt === "string" ? raw.savedAt : undefined);
  const reviewAt = row.review_at ?? (typeof raw.reviewAt === "string" ? raw.reviewAt : undefined);

  if (status) card.status = status;
  if (savedAt) card.savedAt = savedAt;
  if (reviewAt) card.reviewAt = reviewAt;

  return card;
}
