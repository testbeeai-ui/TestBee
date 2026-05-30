/**
 * Infer contiguous "play sessions" from flat play_history rows for admin review.
 * There is no session_id in the schema; we cluster by time gap between consecutive answers.
 */

export const PLAY_SESSION_GAP_MS = 25 * 60 * 1000;

export const PLAY_SESSION_INFERENCE_NOTE =
  "Sessions are inferred from loaded attempts: a new session starts after roughly 25 minutes with no answers. " +
  "Only the most recent chunk of attempts is loaded from the database; totals above that cap are summarized separately.";

export type PlaySessionSummary<A> = {
  /** Stable within one insights payload (firstAttemptId:lastAttemptId). */
  id: string;
  startedAt: string;
  endedAt: string;
  attemptCount: number;
  correctCount: number;
  wrongCount: number;
  distinctPoolKeys: string[];
  attempts: A[];
};

type AttemptLike = {
  id: string;
  created_at: string;
  pool_key: string | null;
  is_correct: boolean;
};

export function buildPlaySessionsFromAttempts<A extends AttemptLike>(
  rows: A[],
  gapMs: number = PLAY_SESSION_GAP_MS
): PlaySessionSummary<A>[] {
  if (rows.length === 0) return [];

  const sorted = [...rows].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const clusters: A[][] = [];
  let current: A[] = [sorted[0]!];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const row = sorted[i]!;
    const dt = new Date(row.created_at).getTime() - new Date(prev.created_at).getTime();
    if (dt > gapMs) {
      clusters.push(current);
      current = [row];
    } else {
      current.push(row);
    }
  }
  clusters.push(current);

  const summaries = clusters.map((attempts) => {
    const first = attempts[0]!;
    const last = attempts[attempts.length - 1]!;
    const pools = [
      ...new Set(attempts.map((a) => a.pool_key).filter((k): k is string => Boolean(k))),
    ];
    const correctCount = attempts.filter((a) => a.is_correct).length;
    const wrongCount = attempts.length - correctCount;
    return {
      id: `${first.id}:${last.id}`,
      startedAt: first.created_at,
      endedAt: last.created_at,
      attemptCount: attempts.length,
      correctCount,
      wrongCount,
      distinctPoolKeys: pools,
      attempts,
    };
  });

  summaries.sort((a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime());
  return summaries;
}
