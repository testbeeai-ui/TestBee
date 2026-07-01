import { describe, expect, it } from "vitest";
import { parseOAuthCallbackParams } from "./oauthCallbackParams";

describe("oauthCallbackParams", () => {
  it("parses pkce code from query", () => {
    expect(parseOAuthCallbackParams("edublast://auth/callback?code=abc").code).toBe("abc");
  });

  it("parses tokens from hash", () => {
    const parsed = parseOAuthCallbackParams(
      "exp://192.168.2.4:8081/--/auth/callback#access_token=aaa&refresh_token=bbb"
    );
    expect(parsed.accessToken).toBe("aaa");
    expect(parsed.refreshToken).toBe("bbb");
  });
});
