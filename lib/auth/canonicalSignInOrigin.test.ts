import { describe, expect, it } from "vitest";
import {
  getCanonicalSiteOrigin,
  isVercelPreviewHostname,
} from "@/lib/auth/canonicalSignInOrigin";

describe("canonicalSignInOrigin", () => {
  it("treats vercel preview hosts as preview", () => {
    expect(isVercelPreviewHostname("edu-blast-testbees-projects.vercel.app")).toBe(true);
    expect(isVercelPreviewHostname("www.edublast.in")).toBe(false);
    expect(isVercelPreviewHostname("edublast.in")).toBe(false);
    expect(isVercelPreviewHostname("localhost")).toBe(false);
  });

  it("uses www.edublast.in as canonical", () => {
    expect(getCanonicalSiteOrigin()).toBe("https://www.edublast.in");
  });
});
