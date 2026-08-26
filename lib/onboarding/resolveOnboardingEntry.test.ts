import { describe, expect, it } from "vitest";
import { resolveOnboardingEntry } from "@/lib/onboarding/resolveOnboardingEntry";

describe("resolveOnboardingEntry", () => {
  it("shows the role picker on Welcome back even if whitelist/storage says teacher", () => {
    expect(
      resolveOnboardingEntry({
        authMode: "signin",
        urlRole: "teacher",
        storedIntent: "teacher",
        profileRole: "teacher",
        profileTimedOut: false,
      })
    ).toEqual({ role: null, step: "role" });
  });

  it("shows the role picker when auth mode is missing after a wiped user", () => {
    expect(
      resolveOnboardingEntry({
        authMode: null,
        urlRole: "teacher",
        storedIntent: "teacher",
        profileRole: "student",
        profileTimedOut: false,
      })
    ).toEqual({ role: null, step: "role" });
  });

  it("skips the picker when signup already chose teacher", () => {
    expect(
      resolveOnboardingEntry({
        authMode: "signup",
        urlRole: "teacher",
        storedIntent: "teacher",
        profileRole: "student",
        profileTimedOut: false,
      })
    ).toEqual({ role: "teacher", step: "details" });
  });

  it("skips the picker when signup already chose student", () => {
    expect(
      resolveOnboardingEntry({
        authMode: "signup",
        urlRole: null,
        storedIntent: "student",
        profileRole: null,
        profileTimedOut: false,
      })
    ).toEqual({ role: "student", step: "details" });
  });

  it("falls back to student details if the profile never loads", () => {
    expect(
      resolveOnboardingEntry({
        authMode: "signin",
        urlRole: null,
        storedIntent: null,
        profileRole: null,
        profileTimedOut: true,
      })
    ).toEqual({ role: "student", step: "details" });
  });
});
