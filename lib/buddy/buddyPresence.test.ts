import { describe, expect, it, vi, afterEach } from "vitest";
import {
  BUDDY_LIVE_WINDOW_MS,
  isWithinBuddyLiveWindow,
  resolveBuddyIsOnline,
} from "./buddyPresence";

describe("buddyPresence", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("treats site heartbeat within live window as online", () => {
    vi.useFakeTimers();
    const now = new Date("2026-05-23T12:00:00Z");
    vi.setSystemTime(now);
    const updatedAt = new Date(now.getTime() - 45_000).toISOString();

    expect(isWithinBuddyLiveWindow(updatedAt)).toBe(true);
    expect(
      resolveBuddyIsOnline({
        rightNow: { kind: "idle", lastActiveAt: null },
        sitePresenceUpdatedAt: updatedAt,
      })
    ).toBe(true);
  });

  it("marks away when last heartbeat is older than live window", () => {
    vi.useFakeTimers();
    const now = new Date("2026-05-23T12:00:00Z");
    vi.setSystemTime(now);
    const stale = new Date(now.getTime() - BUDDY_LIVE_WINDOW_MS - 1).toISOString();

    expect(isWithinBuddyLiveWindow(stale)).toBe(false);
    expect(
      resolveBuddyIsOnline({
        rightNow: { kind: "online", lastActiveAt: stale },
        sitePresenceUpdatedAt: stale,
      })
    ).toBe(false);
  });
});
