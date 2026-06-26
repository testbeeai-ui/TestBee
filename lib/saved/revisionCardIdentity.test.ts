import { describe, expect, it } from "vitest";
import {
  buildRevisionCardSaveId,
  dedupeRevisionCards,
  isRevisionCardSaved,
  normalizeRevisionCardForSave,
  revisionCardFingerprint,
} from "./revisionCardIdentity";

const base = {
  type: "concept" as const,
  frontContent: "What is F = ma?",
  backContent: "Newton's second law.",
  subtopicName: "Laws of Motion",
  topic: "Motion",
  subject: "physics" as const,
  classLevel: 11 as const,
  level: "advanced" as const,
};

describe("revisionCardIdentity", () => {
  it("maps unstable AI deck ids to stable content-based save ids", () => {
    const a = buildRevisionCardSaveId({ ...base, id: "ai-Motion-Laws-advanced-0" });
    const b = buildRevisionCardSaveId({ ...base, id: "ai-Motion-Laws-advanced-3" });
    expect(a).toBe(b);
    expect(a.startsWith("rev-")).toBe(true);
  });

  it("keeps catalog and user ids unchanged", () => {
    expect(buildRevisionCardSaveId({ ...base, id: "dd-1" })).toBe("dd-1");
    expect(buildRevisionCardSaveId({ ...base, id: "user-123" })).toBe("user-123");
  });

  it("detects saved cards by fingerprint even when legacy ai id differs", () => {
    const deck = { ...base, id: "ai-Motion-Laws-advanced-0" };
    const saved = [
      normalizeRevisionCardForSave({
        ...deck,
        id: "ai-Motion-Laws-advanced-0",
      }),
    ];
    expect(isRevisionCardSaved(saved, { ...deck, id: "ai-Motion-Laws-advanced-9" })).toBe(true);
  });

  it("dedupes duplicate fingerprints and duplicate ids", () => {
    const fp = revisionCardFingerprint({ ...base, id: "dd-1" });
    expect(fp).toBeTruthy();
    const out = dedupeRevisionCards([
      { ...base, id: "rev-abc", savedAt: "2026-01-01T00:00:00.000Z" },
      { ...base, id: "ai-old-0", savedAt: "2026-06-01T00:00:00.000Z" },
      { ...base, id: "rev-abc", savedAt: "2026-06-02T00:00:00.000Z" },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]?.id).toBe("rev-abc");
    expect(out[0]?.savedAt).toBe("2026-06-02T00:00:00.000Z");
  });

  it("preserves reviewAt when normalizing for save", () => {
    const stamped = normalizeRevisionCardForSave({
      ...base,
      id: "rev-abc",
      status: "tomorrow",
      reviewAt: "2026-06-22T03:30:00.000Z",
    });
    expect(stamped.reviewAt).toBe("2026-06-22T03:30:00.000Z");
    expect(stamped.status).toBe("tomorrow");
  });
});
