import { afterEach, describe, expect, it } from "vitest";

import {
  ONBOARDING_REWARD_DISMISS_COOLDOWN_MS,
  isOnboardingRewardDismissedCooldownActive,
  setOnboardingRewardDismissedCooldown,
} from "@/lib/subscription/freeTrialClient";

const HOUR_MS = 60 * 60 * 1000;

function installMemoryLocalStorage(): void {
  const store = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };
  Object.defineProperty(globalThis, "window", {
    value: { localStorage },
    configurable: true,
    writable: true,
  });
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, "window");
});

describe("site tour dismiss cooldown", () => {
  it("is 24 hours, not 1 hour", () => {
    expect(ONBOARDING_REWARD_DISMISS_COOLDOWN_MS).toBe(24 * HOUR_MS);
  });

  it("keeps auto-open blocked for 24 hours after close", () => {
    installMemoryLocalStorage();
    const closedAt = Date.parse("2026-09-04T12:00:00.000Z");
    setOnboardingRewardDismissedCooldown(closedAt);

    expect(isOnboardingRewardDismissedCooldownActive(closedAt + HOUR_MS)).toBe(true);
    expect(isOnboardingRewardDismissedCooldownActive(closedAt + 23 * HOUR_MS)).toBe(true);
    expect(isOnboardingRewardDismissedCooldownActive(closedAt + 24 * HOUR_MS)).toBe(false);
  });
});
