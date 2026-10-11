import { describe, expect, it } from "vitest";
import { namedLinkHref, namedSlugError, normalizeNamedSlug } from "@/lib/named-links/slug";

describe("named link slugs", () => {
  it("normalises a display name into a url word", () => {
    expect(normalizeNamedSlug(" MrPhani ")).toBe("mrphani");
    expect(namedSlugError("mrphani")).toBeNull();
  });

  it("rejects site pages and empty names", () => {
    expect(namedSlugError("learnhub")).toMatch(/already a page/);
    expect(namedSlugError("chapter-pyq")).toMatch(/already a page/);
    expect(namedSlugError("a")).toMatch(/2 to 40/);
    expect(namedSlugError("mr phani!")).toMatch(/letters/);
  });

  it("points a subject name at that Learn Hub page", () => {
    expect(namedLinkHref("learnhub", "math")).toBe("/learnhub/mathematics");
    expect(namedLinkHref("learnhub", "physics")).toBe("/learnhub/physics");
    expect(namedLinkHref("learnhub", null)).toBeNull();
  });

  it("points a pyq name at that subject on chapter pyq", () => {
    expect(namedLinkHref("chapter_pyq", "physics")).toBe("/chapter-pyq?subject=physics");
    expect(namedLinkHref("chapter_pyq", "math")).toBe("/chapter-pyq?subject=math");
    expect(namedLinkHref("chapter_pyq", null)).toBe("/chapter-pyq");
  });
});
