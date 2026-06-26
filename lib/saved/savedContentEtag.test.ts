import { describe, expect, it } from "vitest";
import {
  filterSavedContentBundle,
  parseSavedContentTypesParam,
  savedContentWeakEtag,
} from "./savedContentEtag";
import type { SavedRevisionCard } from "@/types";

const baseCard: SavedRevisionCard = {
  id: "rev-1",
  type: "concept",
  frontContent: "Q",
  backContent: "A",
  subtopicName: "T",
  topic: "U",
  subject: "physics",
  classLevel: 11,
  status: "new",
};

describe("parseSavedContentTypesParam", () => {
  it("maps revision_cards alias", () => {
    expect(parseSavedContentTypesParam("revision_cards")).toEqual(["savedRevisionCards"]);
  });

  it("returns null for empty param", () => {
    expect(parseSavedContentTypesParam(null)).toBeNull();
    expect(parseSavedContentTypesParam("  ")).toBeNull();
  });
});

describe("filterSavedContentBundle", () => {
  it("zeros non-requested types", () => {
    const bundle = {
      savedBits: [{ id: "b1" } as never],
      savedFormulas: [],
      savedRevisionCards: [baseCard],
      savedRevisionUnits: [],
      savedCommunityPosts: [],
    };
    const filtered = filterSavedContentBundle(bundle, ["savedRevisionCards"]);
    expect(filtered.savedRevisionCards).toHaveLength(1);
    expect(filtered.savedBits).toHaveLength(0);
  });
});

describe("savedContentWeakEtag", () => {
  it("never embeds control characters in the header value", () => {
    const bundle = {
      savedBits: [],
      savedFormulas: [],
      savedRevisionCards: [
        {
          ...baseCard,
          id: "rev-with\u001fseparator",
          reviewAt: "2026-06-23T09:00:00.000Z",
        },
      ],
      savedRevisionUnits: [],
      savedCommunityPosts: [],
    };
    const etag = savedContentWeakEtag(bundle, null);
    expect(etag).toMatch(/^[\x20-\x7E]+$/);
    expect(etag).toMatch(/^W\/"[a-z_,]+-[0-9a-f]{16}"$/);
  });

  it("scopes etag by types param", () => {
    const bundle = {
      savedBits: [{ id: "b1" } as never],
      savedFormulas: [],
      savedRevisionCards: [baseCard],
      savedRevisionUnits: [],
      savedCommunityPosts: [],
    };
    const all = savedContentWeakEtag(bundle, null);
    const cardsOnly = savedContentWeakEtag(bundle, ["savedRevisionCards"]);
    expect(all).not.toBe(cardsOnly);
    expect(all.startsWith('W/"all-')).toBe(true);
    expect(cardsOnly.startsWith('W/"savedRevisionCards-')).toBe(true);
    expect(all).toMatch(/^W\/"[a-z_,]+-[0-9a-f]{16}"$/);
  });
});
