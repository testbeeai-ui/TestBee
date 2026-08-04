import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startVisiblePoll } from "@/lib/telemetry/visiblePoll";

type Listener = () => void;

function installDom(opts: { visible: boolean; onLine?: boolean; effectiveType?: string }) {
  const listeners: Record<string, Listener[]> = {};
  const doc = {
    visibilityState: opts.visible ? "visible" : "hidden",
    addEventListener: (type: string, fn: Listener) => {
      (listeners[type] ??= []).push(fn);
    },
    removeEventListener: (type: string, fn: Listener) => {
      listeners[type] = (listeners[type] ?? []).filter((f) => f !== fn);
    },
  };
  vi.stubGlobal("document", doc);
  vi.stubGlobal("navigator", {
    onLine: opts.onLine ?? true,
    connection: opts.effectiveType ? { effectiveType: opts.effectiveType } : undefined,
  });
  // `setInterval`/`clearTimeout` come from the fake timers already installed on globalThis.
  vi.stubGlobal("window", {
    setInterval: (fn: () => void, ms: number) => setInterval(fn, ms) as unknown as number,
    clearInterval: (id: number) => clearInterval(id as unknown as NodeJS.Timeout),
  });

  return {
    doc,
    becomeVisible() {
      doc.visibilityState = "visible";
      for (const fn of listeners["visibilitychange"] ?? []) fn();
    },
    becomeHidden() {
      doc.visibilityState = "hidden";
      for (const fn of listeners["visibilitychange"] ?? []) fn();
    },
    listenerCount(type: string) {
      return (listeners[type] ?? []).length;
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("startVisiblePoll", () => {
  it("ticks on the interval while visible and online", () => {
    installDom({ visible: true });
    const onTick = vi.fn();
    const stop = startVisiblePoll({ intervalMs: 12_000, onTick });

    vi.advanceTimersByTime(36_000);
    expect(onTick).toHaveBeenCalledTimes(3);
    stop();
  });

  it("skips ticks while the tab is hidden", () => {
    installDom({ visible: false });
    const onTick = vi.fn();
    const stop = startVisiblePoll({ intervalMs: 12_000, onTick });

    vi.advanceTimersByTime(60_000);
    expect(onTick).not.toHaveBeenCalled();
    stop();
  });

  it("skips ticks while offline even if visible", () => {
    installDom({ visible: true, onLine: false });
    const onTick = vi.fn();
    const stop = startVisiblePoll({ intervalMs: 12_000, onTick });

    vi.advanceTimersByTime(60_000);
    expect(onTick).not.toHaveBeenCalled();
    stop();
  });

  it("catches up immediately when the tab becomes visible again", () => {
    const dom = installDom({ visible: false });
    const onTick = vi.fn();
    const stop = startVisiblePoll({ intervalMs: 12_000, onTick });

    vi.advanceTimersByTime(60_000);
    expect(onTick).not.toHaveBeenCalled();

    dom.becomeVisible();
    expect(onTick).toHaveBeenCalledTimes(1);
    stop();
  });

  it("does not tick when becoming hidden", () => {
    const dom = installDom({ visible: true });
    const onTick = vi.fn();
    const stop = startVisiblePoll({ intervalMs: 12_000, onTick });

    dom.becomeHidden();
    expect(onTick).not.toHaveBeenCalled();
    stop();
  });

  it("stretches the interval on a slow connection", () => {
    installDom({ visible: true, effectiveType: "2g" });
    const onTick = vi.fn();
    const stop = startVisiblePoll({ intervalMs: 12_000, onTick });

    // 4x multiplier: nothing at 12s, one tick at 48s.
    vi.advanceTimersByTime(12_000);
    expect(onTick).not.toHaveBeenCalled();
    vi.advanceTimersByTime(36_000);
    expect(onTick).toHaveBeenCalledTimes(1);
    stop();
  });

  it("removes its listener and stops ticking after cleanup", () => {
    const dom = installDom({ visible: true });
    const onTick = vi.fn();
    const stop = startVisiblePoll({ intervalMs: 12_000, onTick });
    expect(dom.listenerCount("visibilitychange")).toBe(1);

    stop();
    expect(dom.listenerCount("visibilitychange")).toBe(0);
    vi.advanceTimersByTime(60_000);
    expect(onTick).not.toHaveBeenCalled();
  });

  it("opts out of the visibility catch-up when asked", () => {
    const dom = installDom({ visible: false });
    const onTick = vi.fn();
    const stop = startVisiblePoll({
      intervalMs: 12_000,
      onTick,
      tickOnBecomeVisible: false,
    });

    expect(dom.listenerCount("visibilitychange")).toBe(0);
    dom.becomeVisible();
    expect(onTick).not.toHaveBeenCalled();
    stop();
  });
});
