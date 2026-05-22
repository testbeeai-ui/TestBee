/** Stable fingerprint for buddy activity — changes only when study context changes, not every heartbeat tick. */
export function buddyPresenceFingerprint(row: {
  board: string;
  subject: string;
  class_level: number;
  topic: string;
  subtopic_name: string;
  level: string;
  panel: string;
}): string {
  return [
    row.board,
    row.subject,
    String(row.class_level),
    row.topic,
    row.subtopic_name,
    row.level,
    row.panel,
  ].join("|");
}

export function buildBuddyActivityRevision(input: {
  presenceFingerprint: string | null;
  dwellOccurredAt: string | null;
  lessonMarkedAt: string | null;
  topicQuizSubmittedAt: string | null;
  latestGyanDoubtAt: string | null;
  latestCommunityPostAt: string | null;
  gyanPresenceUpdatedAt: string | null;
  sitePresenceUpdatedAt?: string | null;
}): string {
  const p = input.presenceFingerprint ?? "";
  const d = input.dwellOccurredAt ?? "";
  const m = input.lessonMarkedAt ?? "";
  const q = input.topicQuizSubmittedAt ?? "";
  const g = input.latestGyanDoubtAt ?? "";
  const c = input.latestCommunityPostAt ?? "";
  const y = input.gyanPresenceUpdatedAt ?? "";
  const s = input.sitePresenceUpdatedAt ?? "";
  if (!p && !d && !m && !q && !g && !c && !y && !s) return "none";
  return `${p}::${d}::${m}::${q}::${g}::${c}::${y}::${s}`;
}
