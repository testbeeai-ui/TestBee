import { shouldSendTelemetry, telemetryIntervalMultiplier } from "@/lib/telemetry/networkConditions";

export type VisiblePollOptions = {
  /** Base gap between ticks on a healthy connection. */
  intervalMs: number;
  /** Runs only when the document is visible and the browser reports connectivity. */
  onTick: () => void;
  /**
   * Re-run as soon as the tab becomes visible again. Polls that exist to notice
   * out-of-band progress (onboarding steps completed in another tab) want this so
   * returning to the tab feels instant instead of waiting out the interval.
   */
  tickOnBecomeVisible?: boolean;
};

/**
 * A `setInterval` that does not run in the background.
 *
 * Several trackers polled a status endpoint every 12 seconds unconditionally, so a
 * backgrounded tab kept requesting progress that nobody could see — the worst case being
 * a student who leaves the tab open all day on mobile data. Ticks are skipped (not
 * queued) while hidden or offline, since every current caller re-reads full state each
 * time and has nothing to catch up on.
 *
 * @returns a cleanup function; call it from the effect that started the poll.
 */
export function startVisiblePoll({
  intervalMs,
  onTick,
  tickOnBecomeVisible = true,
}: VisiblePollOptions): () => void {
  if (typeof window === "undefined") return () => {};

  const isActive = () => document.visibilityState === "visible" && shouldSendTelemetry();

  const intervalId = window.setInterval(
    () => {
      if (!isActive()) return;
      onTick();
    },
    intervalMs * telemetryIntervalMultiplier()
  );

  const onVisibilityChange = () => {
    if (tickOnBecomeVisible && isActive()) onTick();
  };

  if (tickOnBecomeVisible) {
    document.addEventListener("visibilitychange", onVisibilityChange);
  }

  return () => {
    window.clearInterval(intervalId);
    if (tickOnBecomeVisible) {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    }
  };
}
