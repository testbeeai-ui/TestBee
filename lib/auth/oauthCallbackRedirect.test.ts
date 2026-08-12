import { describe, expect, it } from "vitest";
import {
  isOAuthAuthorizationCode,
  isOAuthPkceLandingPath,
  shouldRedirectOAuthCodeToCallback,
  shouldRetryOAuthExchangeOnClient,
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
        "/preview",
        "25449542-835d-4793-9404-1404cd2fd34e"
      )
    ).toBe(false);
  });

  it("treats auth callback routes as PKCE landings for any code shape", () => {
    expect(isOAuthPkceLandingPath("/auth/callback")).toBe(true);
    expect(isOAuthPkceLandingPath("/auth/callback/finish")).toBe(true);
    expect(isOAuthPkceLandingPath("/auth/mobile-callback")).toBe(true);
    expect(isOAuthPkceLandingPath("/auth")).toBe(false);
    expect(isOAuthPkceLandingPath("/home")).toBe(false);
  });

  it("retries PKCE verifier failures in the browser", () => {
    expect(
      shouldRetryOAuthExchangeOnClient("invalid request: both auth code and code verifier should be non-empty")
    ).toBe(true);
    expect(shouldRetryOAuthExchangeOnClient("Invalid API key")).toBe(false);
  });
});
