import { describe, expect, it } from "vitest";
import { PREVIEW_AUTH_PATH } from "@/lib/auth/previewAuthPath";
import {
  evaluateWhitelistGate,
  isEduDecaMockDestination,
  isEduDecaMockWaitlistExempt,
  shouldEvaluateWaitlistGate,
  waitlistBlockedAuthUrl,
} from "@/lib/waitlist/whitelistGate";

function makeGateClient(opts: {
  profile?: { role: string | null; onboarding_complete?: boolean } | null;
  approved?: { role: string } | null;
  edudecaProgress?: { user_id: string; disciplines?: unknown } | null;
}) {
  return {
    from(table: string) {
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        async maybeSingle() {
          if (table === "user_roles") return { data: null, error: null };
          if (table === "profiles") {
            return {
              data: opts.profile ?? { role: "student", onboarding_complete: false },
              error: null,
            };
          }
          if (table === "approved_emails") return { data: opts.approved ?? null, error: null };
          if (table === "edudeca_user_progress") {
            return { data: opts.edudecaProgress ?? null, error: null };
          }
          return { data: null, error: null };
        },
      };
    },
  };
}

describe("waitlistBlockedAuthUrl", () => {
  it("includes error, signin mode, and attempted email", () => {
    const url = waitlistBlockedAuthUrl("https://app.edublast.in", "Student@Gmail.com");
    expect(url).toContain("error=waitlist_not_approved");
    expect(url).toContain("mode=signin");
    expect(url).toContain("attempted=student%40gmail.com");
  });

  it("omits attempted when email missing", () => {
    expect(waitlistBlockedAuthUrl("https://app.edublast.in")).not.toContain("attempted=");
  });

  it("supports custom entry base for secret login", () => {
    const url = waitlistBlockedAuthUrl("https://app.edublast.in", "a@b.com", PREVIEW_AUTH_PATH);
    expect(url).toContain(PREVIEW_AUTH_PATH);
    expect(url).toContain("error=waitlist_not_approved");
  });
});

describe("shouldEvaluateWaitlistGate", () => {
  it("skips waitlist for completed onboarding", () => {
    expect(
      shouldEvaluateWaitlistGate({ onboardingComplete: true, profileQueryFailed: false }),
    ).toBe(false);
  });

  it("does not sign the user out when the profile read failed", () => {
    expect(
      shouldEvaluateWaitlistGate({ onboardingComplete: false, profileQueryFailed: true }),
    ).toBe(false);
  });

  it("still gates new or incomplete profiles", () => {
    expect(
      shouldEvaluateWaitlistGate({ onboardingComplete: false, profileQueryFailed: false }),
    ).toBe(true);
  });
});

describe("isEduDecaMockDestination", () => {
  it("matches the EduDeca mock handoff path", () => {
    expect(isEduDecaMockDestination("/edudeca-mock")).toBe(true);
    expect(isEduDecaMockDestination("/edudeca-mock?level=1&set=1")).toBe(true);
    expect(isEduDecaMockDestination("/home")).toBe(false);
  });
});

describe("isEduDecaMockWaitlistExempt", () => {
  it("exempts the current mock page so token refresh cannot sign the student out", () => {
    expect(isEduDecaMockWaitlistExempt(null, "/edudeca-mock?level=2&set=1")).toBe(true);
    expect(isEduDecaMockWaitlistExempt("/edudeca-mock?level=1&set=1")).toBe(true);
    expect(isEduDecaMockWaitlistExempt(null, "/home")).toBe(false);
  });
});

describe("evaluateWhitelistGate", () => {
  it("allows a completed student who is not on approved_emails", async () => {
    const client = makeGateClient({
      profile: { role: "student", onboarding_complete: true },
      approved: null,
    });
    await expect(
      evaluateWhitelistGate(client as never, {
        userId: "u1",
        email: "a@b.com",
        onboardingComplete: false,
      }),
    ).resolves.toEqual({ allowed: true, reason: "onboarding_complete" });
  });

  it("allows an EduDeca student with a lineup even when waitlist and onboarding are incomplete", async () => {
    const client = makeGateClient({
      profile: { role: "student", onboarding_complete: false },
      approved: null,
      edudecaProgress: {
        user_id: "u-edudeca",
        disciplines: ["phy", "chem", "math", "bio", "eng", "his", "geo", "civ", "eco", "cs"],
      },
    });
    await expect(
      evaluateWhitelistGate(client as never, {
        userId: "u-edudeca",
        email: "edudeca@example.com",
        onboardingComplete: false,
      }),
    ).resolves.toEqual({ allowed: true, reason: "edudeca_student" });
  });

  it("still blocks a new Web account with no EduDeca lineup", async () => {
    const client = makeGateClient({
      profile: { role: "student", onboarding_complete: false },
      approved: null,
    });
    await expect(
      evaluateWhitelistGate(client as never, {
        userId: "u-new",
        email: "new@example.com",
        onboardingComplete: false,
      }),
    ).resolves.toEqual({ allowed: false, reason: "not_approved" });
  });

  it("does not treat an empty self-inserted progress row as an EduDeca student", async () => {
    const client = makeGateClient({
      profile: { role: "student", onboarding_complete: false },
      approved: null,
      edudecaProgress: { user_id: "u-fake", disciplines: [] },
    });
    await expect(
      evaluateWhitelistGate(client as never, {
        userId: "u-fake",
        email: "fake@example.com",
        onboardingComplete: false,
      }),
    ).resolves.toEqual({ allowed: false, reason: "not_approved" });
  });
});
