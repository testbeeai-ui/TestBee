import { describe, expect, it } from "vitest";
import { fingerprintSavedContentSnapshot } from "./savedContentService";
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

describe("fingerprintSavedContentSnapshot", () => {
  it("changes when revision recall status changes", () => {
    const a = fingerprintSavedContentSnapshot([], [], [baseCard], [], []);
    const b = fingerprintSavedContentSnapshot(
      [],
      [],
      [{ ...baseCard, status: "tomorrow", reviewAt: "2026-06-22T03:30:00.000Z" }],
      [],
      []
    );
    expect(a).not.toBe(b);
  });

  it("is stable for identical snapshots", () => {
    const cards = [baseCard, { ...baseCard, id: "rev-2" }];
    expect(fingerprintSavedContentSnapshot([], [], cards, [], [])).toBe(
      fingerprintSavedContentSnapshot([], [], cards, [], [])
    );
  });
});
