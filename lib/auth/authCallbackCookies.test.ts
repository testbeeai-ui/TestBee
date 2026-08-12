import { describe, expect, it } from "vitest";
import { authCallbackCookieOptions } from "@/lib/auth/authCallbackCookies";

describe("authCallbackCookieOptions", () => {
  it("drops Secure and Domain on http localhost so the session cookie can stick", () => {
    const opts = authCallbackCookieOptions(
      {
        path: "/",
        sameSite: "lax",
        secure: true,
        domain: "www.edublast.in",
      },
      "http://localhost:3000/auth/callback"
    );
    expect(opts.secure).toBe(false);
    expect(opts.domain).toBeUndefined();
    expect(opts.path).toBe("/");
    expect(opts.sameSite).toBe("lax");
  });

  it("keeps Secure on the live https origin", () => {
    const opts = authCallbackCookieOptions(
      { path: "/", sameSite: "lax", secure: true },
      "https://www.edublast.in/auth/callback"
    );
    expect(opts.secure).toBe(true);
    expect(opts.path).toBe("/");
  });
});
