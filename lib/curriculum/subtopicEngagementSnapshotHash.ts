import type { SubtopicEngagementSnapshot } from "@/lib/curriculum/subtopicEngagementService";

/** Stable fingerprint for skip-unchanged writes (excludes volatile `updatedAt`). */
export function fingerprintSubtopicEngagementSnapshot(
  snapshot: SubtopicEngagementSnapshot
): string {
  const { updatedAt: _updatedAt, ...rest } = snapshot;
  return JSON.stringify(rest);
}

export function subtopicEngagementSnapshotsEqual(
  a: SubtopicEngagementSnapshot | null | undefined,
  b: SubtopicEngagementSnapshot
): boolean {
  if (!a) return false;
  return fingerprintSubtopicEngagementSnapshot(a) === fingerprintSubtopicEngagementSnapshot(b);
}
