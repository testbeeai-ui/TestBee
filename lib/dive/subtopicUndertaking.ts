/**
 * Persist Dive Quiz / Numerals / Learning Outcomes undertaking once per subtopic (per user).
 * After "I Agree & Proceed", those activities on that subtopic skip the dialog.
 */

const STORAGE_PREFIX = "edublast:dive-undertaking:v1:";

function storageKey(userId: string, lessonPath: string): string {
  return `${STORAGE_PREFIX}${userId}:${lessonPath}`;
}

export function hasAcceptedSubtopicUndertaking(userId: string, lessonPath: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(storageKey(userId, lessonPath)) === "1";
  } catch {
    return false;
  }
}

export function markSubtopicUndertakingAccepted(userId: string, lessonPath: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(userId, lessonPath), "1");
  } catch {
    /* ignore quota / private mode */
  }
}
