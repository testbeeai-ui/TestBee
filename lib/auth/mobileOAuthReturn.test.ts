import { describe, expect, it } from "vitest";
import {
  buildMobileAppReturnUrl,
  buildMobileAppReturnUrlWithHash,
  isAllowedMobileOAuthReturn,
  parseOAuthCallbackParams,
  resolveMobileAppOAuthReturnTarget,
} from "@/lib/auth/mobileOAuthReturn";

describe("mobileOAuthReturn", () => {
  it("allows edublast and exp schemes only", () => {
    expect(isAllowedMobileOAuthReturn("edublast://auth/callback")).toBe(true);
    expect(isAllowedMobileOAuthReturn("exp://192.168.1.1:8081/--/auth/callback")).toBe(true);
    expect(isAllowedMobileOAuthReturn("https://evil.test")).toBe(false);
  });

  it("appends code to return url", () => {
    expect(buildMobileAppReturnUrl("edublast://auth/callback", "abc123")).toBe(
      "edublast://auth/callback?code=abc123"
    );
  });

  it("forwards hash tokens to app deep link", () => {
    expect(buildMobileAppReturnUrlWithHash("exp://192.168.2.4:8081/--/auth/callback", "#access_token=x&refresh_token=y")).toBe(
      "exp://192.168.2.4:8081/--/auth/callback#access_token=x&refresh_token=y"
    );
  });

  it("parses hash access tokens", () => {
    const parsed = parseOAuthCallbackParams(
      "exp://192.168.2.4:8081/--/auth/callback#access_token=aaa&refresh_token=bbb&token_type=bearer"
    );
    expect(parsed.accessToken).toBe("aaa");
    expect(parsed.refreshToken).toBe("bbb");
  });

  it("resolves preview landing query+hash to app deep link", () => {
    const returnTo = "exp://192.168.2.4:8081/--/auth/callback";
    const search = `?mode=signin&return_to=${encodeURIComponent(returnTo)}&code=25449542-835d-4793-9404-1404cd2fd34e`;
    expect(resolveMobileAppOAuthReturnTarget(returnTo, search, "")).toBe(
      `${returnTo}?code=25449542-835d-4793-9404-1404cd2fd34e`
    );
  });
});
