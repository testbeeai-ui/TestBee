import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isKnownOffline,
  isSaveDataEnabled,
  isSlowConnection,
  shouldSendTelemetry,
  telemetryIntervalMultiplier,
} from "@/lib/telemetry/networkConditions";

type FakeConnection = { effectiveType?: string; saveData?: boolean };

/**
 * The module reads `navigator` lazily on every call, so tests install a fake global rather
 * than needing a DOM environment.
 */
function withNavigator(nav: { onLine?: boolean; connection?: FakeConnection }): void {
  vi.stubGlobal("navigator", nav);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("networkConditions", () => {
  it("treats a missing navigator as a normal connection", () => {
    vi.stubGlobal("navigator", undefined);
    expect(isKnownOffline()).toBe(false);
    expect(shouldSendTelemetry()).toBe(true);
    expect(telemetryIntervalMultiplier()).toBe(1);
  });

  it("reports offline only when the browser says so", () => {
    withNavigator({ onLine: false });
    expect(isKnownOffline()).toBe(true);
    expect(shouldSendTelemetry()).toBe(false);

    withNavigator({ onLine: true });
    expect(isKnownOffline()).toBe(false);
    expect(shouldSendTelemetry()).toBe(true);
  });

  it("does not infer offline from a missing onLine property", () => {
    withNavigator({});
    expect(isKnownOffline()).toBe(false);
    expect(shouldSendTelemetry()).toBe(true);
  });

  it("detects 2G-class connections", () => {
    withNavigator({ onLine: true, connection: { effectiveType: "slow-2g" } });
    expect(isSlowConnection()).toBe(true);

    withNavigator({ onLine: true, connection: { effectiveType: "2g" } });
    expect(isSlowConnection()).toBe(true);

    withNavigator({ onLine: true, connection: { effectiveType: "4g" } });
    expect(isSlowConnection()).toBe(false);
  });

  it("detects the data-saver preference", () => {
    withNavigator({ onLine: true, connection: { saveData: true } });
    expect(isSaveDataEnabled()).toBe(true);

    withNavigator({ onLine: true, connection: { saveData: false } });
    expect(isSaveDataEnabled()).toBe(false);
  });

  it("stretches intervals furthest on the slowest connections", () => {
    withNavigator({ onLine: true, connection: { effectiveType: "4g" } });
    expect(telemetryIntervalMultiplier()).toBe(1);

    withNavigator({ onLine: true, connection: { effectiveType: "3g" } });
    expect(telemetryIntervalMultiplier()).toBe(2);

    withNavigator({ onLine: true, connection: { saveData: true, effectiveType: "4g" } });
    expect(telemetryIntervalMultiplier()).toBe(2);

    withNavigator({ onLine: true, connection: { effectiveType: "2g" } });
    expect(telemetryIntervalMultiplier()).toBe(4);
  });

  it("prefers the slow-connection multiplier when save-data is also on", () => {
    withNavigator({ onLine: true, connection: { effectiveType: "2g", saveData: true } });
    expect(telemetryIntervalMultiplier()).toBe(4);
  });

  it("reads vendor-prefixed connection objects", () => {
    vi.stubGlobal("navigator", { onLine: true, webkitConnection: { effectiveType: "2g" } });
    expect(isSlowConnection()).toBe(true);
  });
});
