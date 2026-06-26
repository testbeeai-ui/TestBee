import { describe, expect, it } from "vitest";
import {
  hydrateRevisionCardFromSavedItemRow,
  slimRevisionCardStorage,
} from "./revisionCardRowPayload";
import type { SavedRevisionCard } from "@/types";

const base: SavedRevisionCard = {
  id: "rev-1",
  type: "concept",
  frontContent: "Q",
  backContent: "A",
  subtopicName: "T",
  topic: "U",
  subject: "physics",
  classLevel: 11,
  status: "tomorrow",
  reviewAt: "2026-06-24T03:30:00.000Z",
  savedAt: "2026-06-20T10:00:00.000Z",
};

describe("slimRevisionCardStorage", () => {
  it("moves recall fields to columns and omits them from data", () => {
    const slim = slimRevisionCardStorage(base);
    expect(slim.status).toBe("tomorrow");
    expect(slim.review_at).toBe(base.reviewAt);
    expect(slim.saved_at).toBe(base.savedAt);
    expect(slim.data).not.toHaveProperty("status");
    expect(slim.data).not.toHaveProperty("reviewAt");
    expect(slim.data).not.toHaveProperty("savedAt");
    expect(slim.data.id).toBe("rev-1");
  });
});

describe("hydrateRevisionCardFromSavedItemRow", () => {
  it("merges slim row columns into card", () => {
    const slim = slimRevisionCardStorage(base);
    const card = hydrateRevisionCardFromSavedItemRow({
      data: slim.data,
      status: slim.status,
      saved_at: slim.saved_at,
      review_at: slim.review_at,
    });
    expect(card.status).toBe("tomorrow");
    expect(card.reviewAt).toBe(base.reviewAt);
    expect(card.savedAt).toBe(base.savedAt);
  });

  it("reads legacy fat JSON when columns are null", () => {
    const card = hydrateRevisionCardFromSavedItemRow({
      data: base,
      status: null,
      saved_at: null,
      review_at: null,
    });
    expect(card.status).toBe("tomorrow");
    expect(card.reviewAt).toBe(base.reviewAt);
  });
});
