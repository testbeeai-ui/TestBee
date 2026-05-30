import type {
  MockLibraryHistoryEntry,
  MockLibraryHistoryKind,
} from "@/lib/mock/fetchMockLibraryHistory";

/** Paper identity for grouping retakes (same test, multiple attempts). */
export function paperGroupKeyForEntry(entry: MockLibraryHistoryEntry): string {
  if (entry.catalogPaperId) return `catalog:${entry.catalogPaperId}`;
  if (entry.pastPaperId) return `past:${entry.pastPaperId}`;
  if (entry.paperSlug) return `slug:${entry.paperSlug}`;
  return `title:${entry.title.trim().toLowerCase()}`;
}

/**
 * Adds attempt index on paper and delta vs chronologically previous attempt on same paper.
 * List order stays newest-first; metadata uses ascending time within each paper group.
 */
export function enrichMockLibraryHistory(
  entries: MockLibraryHistoryEntry[]
): MockLibraryHistoryEntry[] {
  const byPaper = new Map<string, MockLibraryHistoryEntry[]>();

  for (const entry of entries) {
    const key = paperGroupKeyForEntry(entry);
    const list = byPaper.get(key) ?? [];
    list.push(entry);
    byPaper.set(key, list);
  }

  for (const group of byPaper.values()) {
    const chronological = [...group].sort((a, b) => Date.parse(a.takenAt) - Date.parse(b.takenAt));
    const totalOnPaper = chronological.length;

    chronological.forEach((entry, index) => {
      const prev = index > 0 ? chronological[index - 1]! : null;
      entry.attemptIndexOnPaper = index + 1;
      entry.attemptCountOnPaper = totalOnPaper;

      if (prev && entry.scorePercent != null && prev.scorePercent != null) {
        entry.deltaPercentVsPrevious =
          Math.round((entry.scorePercent - prev.scorePercent) * 10) / 10;
      } else {
        entry.deltaPercentVsPrevious = null;
      }

      if (prev && entry.correct != null && prev.correct != null) {
        entry.deltaCorrectVsPrevious = entry.correct - prev.correct;
      } else {
        entry.deltaCorrectVsPrevious = null;
      }
    });
  }

  return entries;
}

export type MockHistoryPaperGroup = {
  groupKey: string;
  title: string;
  kind: MockLibraryHistoryKind;
  paperSlug: string | null;
  /** Newest attempt first. */
  attempts: MockLibraryHistoryEntry[];
  latestTakenAt: string;
};

/** Collapse retakes under one paper title for compact history UI. */
export function groupMockHistoryByPaper(
  entries: MockLibraryHistoryEntry[]
): MockHistoryPaperGroup[] {
  const map = new Map<string, MockLibraryHistoryEntry[]>();

  for (const entry of entries) {
    const key = paperGroupKeyForEntry(entry);
    const list = map.get(key) ?? [];
    list.push(entry);
    map.set(key, list);
  }

  const groups: MockHistoryPaperGroup[] = [];

  for (const [groupKey, list] of map) {
    const attempts = [...list].sort((a, b) => Date.parse(b.takenAt) - Date.parse(a.takenAt));
    const head = attempts[0]!;
    groups.push({
      groupKey,
      title: head.title,
      kind: head.kind,
      paperSlug: head.paperSlug ?? attempts.find((a) => a.paperSlug)?.paperSlug ?? null,
      attempts,
      latestTakenAt: head.takenAt,
    });
  }

  return groups.sort((a, b) => Date.parse(b.latestTakenAt) - Date.parse(a.latestTakenAt));
}
