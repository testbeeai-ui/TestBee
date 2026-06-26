import { describe, expect, it } from "vitest";
import {
  applyRevisionRecallAction,
  countScheduledTomorrow,
  countUnsureInRevisionDeck,
  formatRevisionTomorrowDueLabel,
  getEffectiveRevisionStatus,
  getRevisionRecallFeedback,
  isInMemoryRecallQueue,
  isInRevisionStudyDeck,
  isInTomorrowTab,
  mergeRevisionCardPair,
  mergeRevisionCards,
  promoteDueTomorrowCards,
} from "./revisionCardRecall";
import type { SavedRevisionCard } from "@/types";

const base: SavedRevisionCard = {
  id: "rev-test-1",
  type: "concept",
  frontContent: "Q",
  backContent: "A",
  subtopicName: "Topic",
  topic: "Unit",
  subject: "physics",
  classLevel: 11,
  status: "new",
};

describe("revisionCardRecall", () => {
  it("after 2 AM schedules tomorrow at next calendar day 9:00 AM local", () => {
    const now = new Date(2026, 5, 20, 15, 0, 0).getTime();
    const updated = applyRevisionRecallAction(base, "tomorrow", now);
    expect(updated.status).toBe("tomorrow");
    expect(updated.reviewAt).toBeDefined();
    const due = new Date(updated.reviewAt!);
    expect(due.getFullYear()).toBe(2026);
    expect(due.getMonth()).toBe(5);
    expect(due.getDate()).toBe(21);
    expect(due.getHours()).toBe(9);
    expect(due.getMinutes()).toBe(0);
  });

  it("before 2 AM schedules this calendar day 9:00 AM (late-night grace)", () => {
    const now = new Date(2026, 5, 21, 1, 30, 0).getTime();
    const updated = applyRevisionRecallAction(base, "tomorrow", now);
    const due = new Date(updated.reviewAt!);
    expect(due.getFullYear()).toBe(2026);
    expect(due.getMonth()).toBe(5);
    expect(due.getDate()).toBe(21);
    expect(due.getHours()).toBe(9);
    expect(due.getMinutes()).toBe(0);
  });

  it("at 3 AM schedules next calendar day 9:00 AM", () => {
    const now = new Date(2026, 5, 21, 3, 0, 0).getTime();
    const updated = applyRevisionRecallAction(base, "tomorrow", now);
    const due = new Date(updated.reviewAt!);
    expect(due.getDate()).toBe(22);
    expect(due.getHours()).toBe(9);
  });

  it("promotes due tomorrow cards to new at 9 AM", () => {
    const now = new Date(2026, 5, 21, 9, 0, 0).getTime();
    const scheduled = applyRevisionRecallAction(base, "tomorrow", now - 86400000);
    expect(getEffectiveRevisionStatus(scheduled, now)).toBe("new");
    const [promoted] = promoteDueTomorrowCards([scheduled], now);
    expect(promoted.status).toBe("new");
    expect(promoted.reviewAt).toBeUndefined();
  });

  it("excludes know_it from recall queue and revision study deck", () => {
    const now = Date.now();
    const mastered = applyRevisionRecallAction(base, "know_it", now);
    expect(isInMemoryRecallQueue(mastered, now)).toBe(false);
    expect(isInRevisionStudyDeck(mastered, now)).toBe(false);
  });

  it("excludes unsure from dashboard recall queue but keeps in revision study deck", () => {
    const now = Date.now();
    const unsure = applyRevisionRecallAction(base, "unsure", now);
    expect(isInMemoryRecallQueue(unsure, now)).toBe(false);
    expect(isInRevisionStudyDeck(unsure, now)).toBe(true);
  });

  it("hides future tomorrow from recall queue but keeps in study deck and tomorrow tab", () => {
    const now = new Date(2026, 5, 20, 12, 0, 0).getTime();
    const scheduled = applyRevisionRecallAction(base, "tomorrow", now);
    expect(isInMemoryRecallQueue(scheduled, now)).toBe(false);
    expect(isInRevisionStudyDeck(scheduled, now)).toBe(true);
    expect(isInTomorrowTab(scheduled, now)).toBe(true);
    expect(countScheduledTomorrow([scheduled], now)).toBe(1);
  });

  it("includes due tomorrow in recall queue after promotion", () => {
    const scheduleAt = new Date(2026, 5, 20, 12, 0, 0).getTime();
    const dueAt = new Date(2026, 5, 21, 9, 0, 0).getTime();
    const scheduled = applyRevisionRecallAction(base, "tomorrow", scheduleAt);
    const [promoted] = promoteDueTomorrowCards([scheduled], dueAt);
    expect(isInMemoryRecallQueue(promoted, dueAt)).toBe(true);
    expect(isInTomorrowTab(promoted, dueAt)).toBe(false);
    expect(countScheduledTomorrow([promoted], dueAt)).toBe(0);
  });

  it("clears reviewAt on know_it and unsure", () => {
    const now = Date.now();
    const tomorrow = applyRevisionRecallAction(base, "tomorrow", now);
    const knowIt = applyRevisionRecallAction(tomorrow, "know_it", now);
    expect(knowIt.reviewAt).toBeUndefined();
    const unsure = applyRevisionRecallAction(tomorrow, "unsure", now);
    expect(unsure.reviewAt).toBeUndefined();
  });

  it("counts unsure cards for revision deck hint", () => {
    const unsure = applyRevisionRecallAction(base, "unsure");
    expect(countUnsureInRevisionDeck([base, unsure])).toBe(1);
  });

  it("mergeRevisionCardPair keeps stronger local recall over stale server new", () => {
    const local = applyRevisionRecallAction(
      { ...base, savedAt: "2026-06-21T12:00:00.000Z" },
      "unsure"
    );
    const server = { ...base, status: "new" as const, savedAt: "2026-06-20T12:00:00.000Z" };
    const merged = mergeRevisionCardPair(local, server);
    expect(merged.status).toBe("unsure");
  });

  it("mergeRevisionCards preserves local tomorrow schedule when server lacks reviewAt", () => {
    const now = new Date(2026, 5, 20, 12, 0, 0).getTime();
    const local = applyRevisionRecallAction(base, "tomorrow", now);
    const server = {
      ...base,
      status: "tomorrow" as const,
      savedAt: "2026-06-21T12:00:00.000Z",
    };
    const merged = mergeRevisionCards([local], [server]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.reviewAt).toBe(local.reviewAt);
  });

  it("formats tomorrow feedback with local due time", () => {
    const now = new Date(2026, 5, 20, 15, 0, 0).getTime();
    const updated = applyRevisionRecallAction(base, "tomorrow", now);
    const label = formatRevisionTomorrowDueLabel(updated.reviewAt!, now);
    expect(label).toMatch(/tomorrow at/i);
    const feedback = getRevisionRecallFeedback("tomorrow", {
      reviewAt: updated.reviewAt,
      nowMs: now,
    });
    expect(feedback.title).toBe("See you tomorrow");
    expect(feedback.description).toContain(label);
  });

  it("returns distinct feedback for unsure and know_it", () => {
    expect(getRevisionRecallFeedback("unsure").title).toMatch(/Unsure/i);
    expect(getRevisionRecallFeedback("know_it").title).toMatch(/known/i);
  });
});
