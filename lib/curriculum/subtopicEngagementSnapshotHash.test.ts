import { describe, expect, it } from "vitest";
import {
  fingerprintSubtopicEngagementSnapshot,
  subtopicEngagementSnapshotsEqual,
} from "./subtopicEngagementSnapshotHash";
import type { SubtopicEngagementSnapshot } from "@/lib/curriculum/subtopicEngagementService";

const base: SubtopicEngagementSnapshot = {
  v: 1,
  bitsSignature: "sig-1",
  updatedAt: "2026-06-22T10:00:00.000Z",
  bits: { currentIdx: 0, selectedAnswers: {}, visitedIndices: [0] },
};

describe("subtopicEngagementSnapshotHash", () => {
  it("ignores updatedAt when comparing snapshots", () => {
    const a = { ...base, updatedAt: "2026-06-22T10:00:00.000Z" };
    const b = { ...base, updatedAt: "2026-06-22T10:05:00.000Z" };
    expect(subtopicEngagementSnapshotsEqual(a, b)).toBe(true);
  });

  it("detects meaningful changes", () => {
    const changed = {
      ...base,
      bits: { currentIdx: 1, selectedAnswers: {}, visitedIndices: [0, 1] },
    };
    expect(fingerprintSubtopicEngagementSnapshot(base)).not.toBe(
      fingerprintSubtopicEngagementSnapshot(changed)
    );
  });
});
