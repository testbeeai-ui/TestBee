import { describe, expect, it } from "vitest";
import {
  oauthSignInFailedMessage,
  oauthTryAgainPathForHost,
  productionSignInUrl,
} from "@/lib/auth/oauthSignInHelp";

describe("oauthSignInFailedMessage", () => {
  it("keeps localhost recovery on localhost instead of trapping to production", () => {
    const msg = oauthSignInFailedMessage("localhost");
    expect(msg).toContain("Google sign-in did not complete on localhost.");
    expect(msg).toContain("http://localhost:3000/auth/callback");
    expect(msg).not.toContain("cannot finish on localhost");
    expect(msg).not.toContain("Open https://www.edublast.in");
    expect(msg).not.toContain("edublast.vercel.app");
  });

  it("points production sign-in at www.edublast.in", () => {
    expect(productionSignInUrl()).toBe(
      "https://www.edublast.in/preview?mode=signin&role=student"
    );
  });
});

describe("oauthTryAgainPathForHost", () => {
  it("stays on the local preview path for localhost", () => {
    expect(oauthTryAgainPathForHost("localhost")).toBe("/preview?mode=signin");
  });

  it("sends Vercel preview hosts to the live site", () => {
    expect(oauthTryAgainPathForHost("edu-blast-testbees-projects.vercel.app")).toBe(
      "https://www.edublast.in/preview?mode=signin&role=student"
    );
  });
});
