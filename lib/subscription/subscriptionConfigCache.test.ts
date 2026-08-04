import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchSubscriptionConfig,
  invalidateSubscriptionConfigCache,
} from "@/lib/subscription/subscriptionConfig";

type Row = { key: string; value: number | null };

/**
 * Stands in for the `rdm_config` read. `calls` counts round trips, which is the whole point
 * of the cache: a dashboard paint asks several components for plan limits at once.
 */
function makeClient(rows: Row[], opts: { fail?: boolean; deferred?: boolean } = {}) {
  let release: (() => void) | null = null;
  const client = {
    calls: 0,
    releasePending() {
      release?.();
      release = null;
    },
    from() {
      return {
        select: async () => {
          client.calls += 1;
          if (opts.deferred) {
            await new Promise<void>((resolve) => {
              release = resolve;
            });
          }
          if (opts.fail) return { data: null, error: { message: "boom" } };
          return { data: rows, error: null };
        },
      };
    },
  };
  return client;
}

const ROWS: Row[] = [{ key: "free_gyan_doubts_per_day", value: 7 }];

beforeEach(() => {
  invalidateSubscriptionConfigCache();
});

afterEach(() => {
  invalidateSubscriptionConfigCache();
  vi.useRealTimers();
});

describe("fetchSubscriptionConfig caching", () => {
  it("reads the config table only once within the TTL", async () => {
    const client = makeClient(ROWS);
    const first = await fetchSubscriptionConfig(client as never);
    const second = await fetchSubscriptionConfig(client as never);

    expect(client.calls).toBe(1);
    expect(second).toEqual(first);
  });

  it("applies values from the table over the defaults", async () => {
    const client = makeClient(ROWS);
    const config = await fetchSubscriptionConfig(client as never);
    expect(config.free_gyan_doubts_per_day).toBe(7);
  });

  it("shares one in-flight request across concurrent callers", async () => {
    const client = makeClient(ROWS, { deferred: true });
    const all = Promise.all([
      fetchSubscriptionConfig(client as never),
      fetchSubscriptionConfig(client as never),
      fetchSubscriptionConfig(client as never),
    ]);

    client.releasePending();
    const [a, b, c] = await all;

    expect(client.calls).toBe(1);
    expect(a).toEqual(b);
    expect(b).toEqual(c);
  });

  it("does not cache a failed read, so the next call retries", async () => {
    const failing = makeClient([], { fail: true });
    await fetchSubscriptionConfig(failing as never);
    await fetchSubscriptionConfig(failing as never);
    expect(failing.calls).toBe(2);
  });

  it("returns defaults when the read fails", async () => {
    const failing = makeClient([], { fail: true });
    const config = await fetchSubscriptionConfig(failing as never);
    // Defaults must still be a complete config object, not a partial.
    expect(config.free_gyan_doubts_per_day).toBe(1);
  });

  it("re-reads after the cache is invalidated", async () => {
    const client = makeClient(ROWS);
    await fetchSubscriptionConfig(client as never);
    invalidateSubscriptionConfigCache();
    await fetchSubscriptionConfig(client as never);
    expect(client.calls).toBe(2);
  });

  it("re-reads once the TTL expires", async () => {
    vi.useFakeTimers();
    const client = makeClient(ROWS);
    await fetchSubscriptionConfig(client as never);
    expect(client.calls).toBe(1);

    vi.advanceTimersByTime(60_001);
    await fetchSubscriptionConfig(client as never);
    expect(client.calls).toBe(2);
  });
});
