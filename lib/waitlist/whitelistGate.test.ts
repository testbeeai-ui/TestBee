import { beforeEach, describe, expect, it, vi } from "vitest";
import { PREVIEW_AUTH_PATH } from "@/lib/auth/previewAuthPath";
import { isAdminUser } from "@/lib/admin/admin";
import {
  evaluateWhitelistGate,
  WAITLIST_GATE_LEGACY_AUTH_CREATED_BEFORE,
  waitlistBlockedAuthUrl,
} from "@/lib/waitlist/whitelistGate";

vi.mock("@/lib/admin/admin", () => ({
  isAdminUser: vi.fn(),
}));

const isAdminUserMock = vi.mocked(isAdminUser);

function supabaseWithApprovedRole(role: "student" | "teacher" | null) {
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: role ? { role } : null }),
  };
  return {
    from: vi.fn(() => query),
  };
}

describe("evaluateWhitelistGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAdminUserMock.mockResolvedValue(false);
  });

  it("does not allow new accounts just because onboarding_complete is true", async () => {
    const supabase = supabaseWithApprovedRole(null);

    const result = await evaluateWhitelistGate(supabase as never, {
      userId: "user-1",
      email: "student@example.com",
      onboardingComplete: true,
      userCreatedAt: "2026-06-11T00:00:00.000Z",
    });

    expect(result).toEqual({ allowed: false, reason: "not_approved" });
  });

  it("allows completed accounts created before the waitlist gate launch", async () => {
    const supabase = supabaseWithApprovedRole(null);

    const result = await evaluateWhitelistGate(supabase as never, {
      userId: "legacy-user",
      email: "legacy@example.com",
      onboardingComplete: true,
      userCreatedAt: "2026-06-09T00:00:00.000Z",
    });

    expect(result).toEqual({ allowed: true, reason: "onboarding_complete" });
    expect(WAITLIST_GATE_LEGACY_AUTH_CREATED_BEFORE).toBe("2026-06-10T09:30:00.000Z");
  });

  it("allows approved emails for new accounts", async () => {
    const supabase = supabaseWithApprovedRole("student");

    const result = await evaluateWhitelistGate(supabase as never, {
      userId: "approved-user",
      email: "student@example.com",
      onboardingComplete: false,
      userCreatedAt: "2026-06-11T00:00:00.000Z",
    });

    expect(result).toEqual({ allowed: true, reason: "approved", approvedRole: "student" });
  });

  it("allows admins before checking email approval", async () => {
    isAdminUserMock.mockResolvedValue(true);
    const supabase = supabaseWithApprovedRole(null);

    const result = await evaluateWhitelistGate(supabase as never, {
      userId: "admin-user",
      email: null,
      onboardingComplete: false,
      userCreatedAt: "2026-06-11T00:00:00.000Z",
    });

    expect(result).toEqual({ allowed: true, reason: "admin" });
    expect(supabase.from).not.toHaveBeenCalled();
  });
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
