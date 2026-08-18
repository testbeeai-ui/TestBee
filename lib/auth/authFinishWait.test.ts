import { describe, expect, it } from "vitest";
import { authFinishShouldArmFailTimer, authFinishWaitPhase } from "@/lib/auth/authFinishWait";

describe("authFinishWaitPhase", () => {
  it("waits for session when there is no user yet", () => {
    expect(authFinishWaitPhase({ user: null, profile: null })).toBe("wait-session");
  });

  it("waits for profile when a session exists but the profile row is still null", () => {
    expect(authFinishWaitPhase({ user: { id: "u1" }, profile: null })).toBe("wait-profile");
  });

  it("redirects once the profile has loaded", () => {
    expect(
      authFinishWaitPhase({
        user: { id: "u1" },
        profile: { onboarding_complete: true },
      })
    ).toBe("redirect");
    expect(
      authFinishWaitPhase({
        user: { id: "u1" },
        profile: { onboarding_complete: false },
      })
    ).toBe("redirect");
  });
});

describe("authFinishShouldArmFailTimer", () => {
  it("arms the fail timer while waiting for a session", () => {
    expect(authFinishShouldArmFailTimer("wait-session")).toBe(true);
  });

  it("arms the fail timer while waiting for a stuck-null profile", () => {
    expect(authFinishShouldArmFailTimer("wait-profile")).toBe(true);
  });

  it("does not arm the fail timer after a redirect decision", () => {
    expect(authFinishShouldArmFailTimer("redirect")).toBe(false);
  });
});
