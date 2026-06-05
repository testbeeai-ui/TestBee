import { describe, expect, it, afterEach } from "vitest";
import { EDUBLAST_PUBLIC_ORIGIN, getPortalBaseUrl } from "@/lib/email/portalBaseUrl";

describe("getPortalBaseUrl", () => {
  const env = process.env;

  afterEach(() => {
    process.env = env;
  });

  it("uses NEXT_PUBLIC_SITE_URL when set", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://edublast.vercel.app/";
    expect(getPortalBaseUrl()).toBe("https://edublast.vercel.app");
  });

  it("falls back to edublast.vercel.app when unset", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.VERCEL_URL;
    expect(getPortalBaseUrl()).toBe(EDUBLAST_PUBLIC_ORIGIN);
  });
});
