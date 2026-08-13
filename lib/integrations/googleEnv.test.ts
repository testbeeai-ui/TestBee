import { afterEach, describe, expect, it } from "vitest";
import {
  GOOGLE_PRODUCTION_REDIRECT_URI,
  isProductionEdublastHost,
  oauthHostFromHeaders,
  resolveGoogleRedirectUri,
} from "@/lib/integrations/googleEnv";

describe("resolveGoogleRedirectUri", () => {
  const previousUri = process.env.GOOGLE_REDIRECT_URI;
  const previousVercel = process.env.VERCEL_ENV;

  afterEach(() => {
    if (previousUri === undefined) delete process.env.GOOGLE_REDIRECT_URI;
    else process.env.GOOGLE_REDIRECT_URI = previousUri;
    if (previousVercel === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = previousVercel;
  });

  it("uses production callback on www.edublast.in even if env is localhost", () => {
    process.env.GOOGLE_REDIRECT_URI = "http://localhost:3000/api/integrations/google/callback";
    delete process.env.VERCEL_ENV;
    expect(resolveGoogleRedirectUri("www.edublast.in")).toBe(GOOGLE_PRODUCTION_REDIRECT_URI);
    expect(resolveGoogleRedirectUri("edublast.in")).toBe(GOOGLE_PRODUCTION_REDIRECT_URI);
  });

  it("keeps env URI for localhost", () => {
    process.env.GOOGLE_REDIRECT_URI = "http://localhost:3000/api/integrations/google/callback";
    delete process.env.VERCEL_ENV;
    expect(resolveGoogleRedirectUri("localhost:3000")).toBe(
      "http://localhost:3000/api/integrations/google/callback"
    );
  });

  it("uses production callback when VERCEL_ENV is production", () => {
    process.env.GOOGLE_REDIRECT_URI = "http://localhost:3000/api/integrations/google/callback";
    process.env.VERCEL_ENV = "production";
    expect(resolveGoogleRedirectUri("localhost:3000")).toBe(GOOGLE_PRODUCTION_REDIRECT_URI);
  });

  it("never uses a localhost env URI on a non-local host", () => {
    process.env.GOOGLE_REDIRECT_URI = "http://localhost:3000/api/integrations/google/callback";
    delete process.env.VERCEL_ENV;
    expect(resolveGoogleRedirectUri("edu-blast-testbees-projects.vercel.app")).toBe(
      GOOGLE_PRODUCTION_REDIRECT_URI
    );
  });
});

describe("oauth host helpers", () => {
  it("prefers x-forwarded-host", () => {
    const headers = {
      get(name: string) {
        if (name === "x-forwarded-host") return "www.edublast.in";
        if (name === "host") return "localhost:3000";
        return null;
      },
    };
    expect(oauthHostFromHeaders(headers)).toBe("www.edublast.in");
    expect(isProductionEdublastHost(oauthHostFromHeaders(headers))).toBe(true);
  });
});
