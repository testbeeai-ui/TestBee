export type SessionTemporalState =
  | "IDLE"
  | "COUNTDOWN"
  | "PRE_JOIN"
  | "LIVE"
  | "GRACE_PERIOD"
  | "COMPLETED";

export type SessionTemporalEvaluation = {
  state: SessionTemporalState;
  nowMs: number;
  startMs: number;
  endMs: number;
  /** Negative when already started. */
  msToStart: number;
  /** Negative when already ended. */
  msToEnd: number;
  /** The moment the session becomes visible on the dashboard (start - 30m). */
  visibleFromMs: number;
  /** The moment the session is considered done for dashboard (end + 10m). */
  visibleUntilMs: number;
};

const MIN = 60 * 1000;

export function evaluateSessionTemporalState(input: {
  nowMs: number;
  startMs: number;
  durationMinutes: number;
}): SessionTemporalEvaluation {
  const { nowMs, startMs } = input;
  const durMin =
    Number.isFinite(input.durationMinutes) && input.durationMinutes > 0
      ? input.durationMinutes
      : 60;
  const endMs = startMs + durMin * MIN;

  const visibleFromMs = startMs - 30 * MIN;
  const preJoinFromMs = startMs - 10 * MIN;
  const graceUntilMs = endMs + 10 * MIN;

  const msToStart = startMs - nowMs;
  const msToEnd = endMs - nowMs;

  // Defined temporal state machine (strict boundaries).
  // Order matters: we compute the first matching state from the boundary table.
  const boundaries: Array<{ state: SessionTemporalState; from: number; to: number }> = [
    { state: "IDLE", from: Number.NEGATIVE_INFINITY, to: visibleFromMs },
    { state: "COUNTDOWN", from: visibleFromMs, to: preJoinFromMs },
    { state: "PRE_JOIN", from: preJoinFromMs, to: startMs },
    { state: "LIVE", from: startMs, to: endMs },
    { state: "GRACE_PERIOD", from: endMs, to: graceUntilMs },
    { state: "COMPLETED", from: graceUntilMs, to: Number.POSITIVE_INFINITY },
  ];

  const hit =
    boundaries.find((b) => nowMs >= b.from && nowMs < b.to) ??
    ({ state: "COMPLETED", from: graceUntilMs, to: Number.POSITIVE_INFINITY } as const);

  return {
    state: hit.state,
    nowMs,
    startMs,
    endMs,
    msToStart,
    msToEnd,
    visibleFromMs,
    visibleUntilMs: graceUntilMs,
  };
}

export function isActiveMeetState(state: SessionTemporalState) {
  return (
    state === "COUNTDOWN" || state === "PRE_JOIN" || state === "LIVE" || state === "GRACE_PERIOD"
  );
}
