import { describe, expect, it } from "vitest";
import {
  isUnableToExchangeExternalCode,
  readOAuthProviderCallbackError,
  supabaseGoogleOAuthRedirectUri,
} from "@/lib/auth/oauthProviderCallbackError";

describe("readOAuthProviderCallbackError", () => {
  it("returns null when there is no provider error", () => {
    expect(readOAuthProviderCallbackError(new URLSearchParams("code=abc"))).toBeNull();
  });

  it("captures Supabase Google exchange failures", () => {
    const params = new URLSearchParams(
      "error=server_error&error_code=unexpected_failure&error_description=Unable+to+exchange+external+code%3A+4%2F0A"
    );
    expect(readOAuthProviderCallbackError(params)).toEqual({
      error: "server_error",
      errorDescription: "Unable to exchange external code: 4/0A",
    });
  });
});

describe("isUnableToExchangeExternalCode", () => {
  it("matches the Supabase Google handshake error", () => {
    expect(
      isUnableToExchangeExternalCode("Unable to exchange external code: 4/0A")
    ).toBe(true);
    expect(isUnableToExchangeExternalCode("missing_code")).toBe(false);
  });
});

describe("supabaseGoogleOAuthRedirectUri", () => {
  it("builds the Google Cloud Authorized redirect URI", () => {
    expect(supabaseGoogleOAuthRedirectUri("https://bytsiknhtcnlxwzgqkrd.supabase.co/")).toBe(
      "https://bytsiknhtcnlxwzgqkrd.supabase.co/auth/v1/callback"
    );
  });
});
