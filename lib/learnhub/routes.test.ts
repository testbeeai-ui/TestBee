import { describe, expect, it } from "vitest";
import {
  canonicalLearnHubRedirect,
  learnHubSubjectFromPathname,
  learnHubSubjectPath,
  learnHubUnitPath,
  parseLearnHubSubjectSlug,
} from "@/lib/learnhub/routes";

function redirect(path: string) {
  const url = new URL(path, "https://www.edublast.in");
  const r = canonicalLearnHubRedirect(url.pathname, url.searchParams);
  if (!r) return null;
  const qs = r.search.toString();
  return qs ? `${r.pathname}?${qs}` : r.pathname;
}

describe("learnhub routes", () => {
  it("uses /mathematics as the canonical Math slug", () => {
    expect(learnHubSubjectPath("math")).toBe("/learnhub/mathematics");
    expect(learnHubSubjectPath("physics")).toBe("/learnhub/physics");
    expect(learnHubSubjectPath("chemistry")).toBe("/learnhub/chemistry");
  });

  it("accepts maths / math / mixed case aliases", () => {
    expect(parseLearnHubSubjectSlug("maths")).toBe("math");
    expect(parseLearnHubSubjectSlug("Math")).toBe("math");
    expect(parseLearnHubSubjectSlug("MATHEMATICS")).toBe("math");
    expect(parseLearnHubSubjectSlug("biology")).toBeNull();
  });

  it("reads the subject from the pathname", () => {
    expect(learnHubSubjectFromPathname("/learnhub")).toBeNull();
    expect(learnHubSubjectFromPathname("/learnhub/chemistry")).toBe("chemistry");
    expect(learnHubSubjectFromPathname("/learnhub/mathematics")).toBe("math");
  });

  it("builds unit resume links under the subject path", () => {
    expect(learnHubUnitPath("physics", 11, "units-and-measurements")).toBe(
      "/learnhub/physics?class=11&unit=units-and-measurements"
    );
  });

  it("forwards legacy /explore-1 links", () => {
    expect(redirect("/explore-1")).toBe("/learnhub");
    expect(redirect("/explore-1?lessonsOnboarding=1")).toBe("/learnhub?lessonsOnboarding=1");
    expect(redirect("/explore-1?subject=math&class=12&unit=matrices")).toBe(
      "/learnhub/mathematics?class=12&unit=matrices"
    );
  });

  it("canonicalises subject aliases and leaves canonical URLs alone", () => {
    expect(redirect("/learnhub/maths")).toBe("/learnhub/mathematics");
    expect(redirect("/learnhub/Physics")).toBe("/learnhub/physics");
    expect(redirect("/learnhub/physics")).toBeNull();
    expect(redirect("/learnhub")).toBeNull();
    expect(redirect("/learnhub/biology")).toBeNull();
  });
});
