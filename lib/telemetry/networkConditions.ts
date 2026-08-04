/**
 * Shared network-condition checks for background telemetry (presence, dwell, engagement).
 *
 * Two problems this solves:
 *
 * 1. Offline. Heartbeats fired regardless of connectivity, so an offline student burned
 *    battery on requests that could only fail, and the failures were swallowed silently.
 * 2. Slow connections. Fixed intervals tuned for broadband mean a 2G student spends a
 *    large share of their bandwidth on telemetry instead of lesson content.
 *
 * Every check degrades to "assume a normal connection" when the browser does not expose
 * the API, so behaviour is unchanged on browsers without Network Information support.
 */

type NetworkInformation = {
  effectiveType?: string;
  saveData?: boolean;
};

function connection(): NetworkInformation | null {
  if (typeof navigator === "undefined") return null;
  const nav = navigator as Navigator & {
    connection?: NetworkInformation;
    mozConnection?: NetworkInformation;
    webkitConnection?: NetworkInformation;
  };
  return nav.connection ?? nav.mozConnection ?? nav.webkitConnection ?? null;
}

/**
 * True only when the browser positively reports being offline. `navigator.onLine`
 * false-positives on "connected but no route", so this is a cheap filter for the
 * obvious case, never a guarantee that a request will succeed.
 */
export function isKnownOffline(): boolean {
  if (typeof navigator === "undefined") return false;
  return navigator.onLine === false;
}

/** User asked the browser to conserve data (Chrome's Lite mode / Data Saver). */
export function isSaveDataEnabled(): boolean {
  return connection()?.saveData === true;
}

/** 2G-class connection, where a background POST competes directly with page content. */
export function isSlowConnection(): boolean {
  const effectiveType = connection()?.effectiveType;
  return effectiveType === "slow-2g" || effectiveType === "2g";
}

/**
 * Multiplier to stretch telemetry intervals by on constrained connections.
 *
 * Deliberately coarse: telemetry accuracy degrades gracefully (deltas accumulate
 * locally and flush later), so trading freshness for bandwidth is nearly free, whereas
 * a mis-tuned multiplier that is too aggressive would lose buddy-presence liveness.
 */
export function telemetryIntervalMultiplier(): number {
  if (isSlowConnection()) return 4;
  if (isSaveDataEnabled() || connection()?.effectiveType === "3g") return 2;
  return 1;
}

/**
 * Single gate for "should a background telemetry request go out right now".
 *
 * Callers must treat `false` as "try again later", not "drop the data" — the point is
 * to keep locally accumulated deltas intact until the connection is usable.
 */
export function shouldSendTelemetry(): boolean {
  return !isKnownOffline();
}
