import { describe, expect, it } from "vitest";
import { shouldApplyWhitelistRoleToProfile } from "@/lib/auth/whitelistRoleSync";

describe("shouldApplyWhitelistRoleToProfile", () => {
  it("does not copy whitelist teacher onto the profile during Welcome back", () => {
    expect(shouldApplyWhitelistRoleToProfile(true)).toBe(false);
  });

  it("still syncs whitelist role during explicit signup", () => {
    expect(shouldApplyWhitelistRoleToProfile(false)).toBe(true);
  });
});
