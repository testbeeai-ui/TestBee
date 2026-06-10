import { describe, expect, it } from "vitest";
import { PREVIEW_AUTH_PATH } from "@/lib/auth/previewAuthPath";
import { waitlistBlockedAuthUrl } from "@/lib/waitlist/whitelistGate";

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
