/** Developer time-travel offset on profiles.time_travel_offset_ms */

export const TIME_TRAVEL_OFFSET_CHANGED_EVENT = "edublast-time-travel-offset-changed";

export type TimeTravelOffsetChangedDetail = {
  offsetMs: number;
  /** When set, streak checklist suppress is cleared (dev jump to a trial day). */
  clearStreakSuppress?: boolean;
};

export function dispatchTimeTravelOffsetChanged(
  offsetMs: number,
  options?: { clearStreakSuppress?: boolean }
): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<TimeTravelOffsetChangedDetail>(TIME_TRAVEL_OFFSET_CHANGED_EVENT, {
      detail: { offsetMs, clearStreakSuppress: options?.clearStreakSuppress },
    })
  );
}

export function getSimulatedNowMs(offsetMs: number): number {
  return Date.now() + offsetMs;
}
