import { beforeEach, describe, expect, it, vi } from "vitest";
import { PREVIEW_AUTH_PATH } from "@/lib/auth/previewAuthPath";
import { isAdminUser } from "@/lib/admin/admin";
import { evaluateWhitelistGate, waitlistBlockedAuthUrl } from "@/lib/waitlist/whitelistGate";

vi.mock("@/lib/admin/admin", () => ({
  isAdminUser: vi.fn(),
}));

function mockSupabase(approvedRole: "student" | "teacher" | null) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => ({
      data: approvedRole ? { role: approvedRole } : null,
    })),
  };

  return {
    from: vi.fn(() => builder),
  };
}

beforeEach(() => {
  vi.mocked(isAdminUser).mockReset();
  vi.mocked(isAdminUser).mockResolvedValue(false);
});

describe("waitlistBlockedAuthUrl", () => {
  it("includes error, signin mode, and attempted email", () => {
    const url = waitlistBlockedAuthUrl("https://app.edublast.in", "Student@Gmail.com");
    expect(url).toContain("error=waitlist_not_approved");
    expect(url).toContain("mode=signin");
    expect(url).toContain("attempted=student%40gmail.com");
  });

  it("omits attempted when email missing", () => {
    const url = waitlistBlockedAuthUrl("https://app.edublast.in");
    expect(url).not.toContain("attempted=");
  });

  it("supports custom entry base for secret login", () => {
    const url = waitlistBlockedAuthUrl("https://app.edublast.in", "a@b.com", PREVIEW_AUTH_PATH);
    expect(url).toContain(PREVIEW_AUTH_PATH);
    expect(url).toContain("error=waitlist_not_approved");
  });
});

describe("evaluateWhitelistGate", () => {
  it("does not treat onboarding_complete as a whitelist grant", async () => {
    const supabase = mockSupabase(null);

    const gate = await evaluateWhitelistGate(supabase as any, {
      userId: "user-1",
      email: "student@example.com",
      onboardingComplete: true,
    });

    expect(gate).toEqual({ allowed: false, reason: "not_approved" });
  });

  it("allows approved emails", async () => {
    const supabase = mockSupabase("student");

    const gate = await evaluateWhitelistGate(supabase as any, {
      userId: "user-1",
      email: "Student@Example.com",
      onboardingComplete: false,
    });

    expect(gate).toEqual({
      allowed: true,
      reason: "approved",
      approvedRole: "student",
    });
  });
});
