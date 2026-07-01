import { describe, expect, it } from "vitest";
import {
  isOAuthAuthorizationCode,
  shouldRedirectOAuthCodeToCallback,
} from "@/lib/auth/oauthCallbackRedirect";

describe("oauthCallbackRedirect", () => {
  it("recognizes Supabase OAuth code shape", () => {
    expect(isOAuthAuthorizationCode("25449542-835d-4793-9404-1404cd2fd34e")).toBe(true);
    expect(isOAuthAuthorizationCode("ABC123")).toBe(false);
  });

  it("redirects homepage OAuth code to callback", () => {
    expect(
      shouldRedirectOAuthCodeToCallback("/", "25449542-835d-4793-9404-1404cd2fd34e")
    ).toBe(true);
    expect(shouldRedirectOAuthCodeToCallback("/join", "ABC12")).toBe(false);
    expect(
      shouldRedirectOAuthCodeToCallback(
        "/auth/callback",
        "25449542-835d-4793-9404-1404cd2fd34e"
      )
    ).toBe(false);
    expect(
      shouldRedirectOAuthCodeToCallback(
        "/auth/mobile-callback",
        "25449542-835d-4793-9404-1404cd2fd34e"
      )
    ).toBe(false);
    expect(
      shouldRedirectOAuthCodeToCallback(
        "/preview-raknas-amu",
        "25449542-835d-4793-9404-1404cd2fd34e"
      )
    ).toBe(false);
  });
});
