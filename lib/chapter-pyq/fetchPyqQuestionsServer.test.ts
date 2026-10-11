import { describe, expect, it } from "vitest";
import {
  isWithinSubjectYearWindow,
  pageRangesAfterFirst,
  subjectFirstExamYear,
} from "./fetchPyqQuestionsServer";
import { subjectForCatalogSlug } from "./catalog";

describe("subject year window", () => {
  it("resolves the subject that owns a catalog slug", () => {
    expect(subjectForCatalogSlug("units-and-measurements")).toBe("physics");
    expect(subjectForCatalogSlug("motion-in-a-straight-line")).toBe("physics");
    expect(subjectForCatalogSlug("definite-integration")).toBe("math");
    expect(subjectForCatalogSlug("not-a-real-slug")).toBeNull();
  });

  it("floors Physics at 2023 and leaves Mathematics unfloored", () => {
    expect(subjectFirstExamYear("units-and-measurements")).toBe(2023);
    expect(subjectFirstExamYear("definite-integration")).toBeNull();
    expect(subjectFirstExamYear("not-a-real-slug")).toBeNull();
  });

  it("serves Physics 2023, 2024, 2025 and 2026 only", () => {
    for (const year of [2023, 2024, 2025, 2026]) {
      expect(isWithinSubjectYearWindow("units-and-measurements", year)).toBe(true);
    }
    for (const year of [2019, 2020, 2021, 2022]) {
      expect(isWithinSubjectYearWindow("units-and-measurements", year)).toBe(false);
    }
    expect(isWithinSubjectYearWindow("units-and-measurements", null)).toBe(false);
    expect(isWithinSubjectYearWindow("units-and-measurements", undefined)).toBe(false);
  });

  it("leaves Mathematics year handling exactly as it was", () => {
    for (const year of [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]) {
      expect(isWithinSubjectYearWindow("definite-integration", year)).toBe(true);
    }
    expect(isWithinSubjectYearWindow("definite-integration", null)).toBe(true);
  });
});

describe("page ranges", () => {
  it("stops when the first page already holds every row", () => {
    expect(pageRangesAfterFirst(121, 121)).toEqual([]);
    expect(pageRangesAfterFirst(40, 40)).toEqual([]);
  });

  it("plans every later page when the total is known", () => {
    expect(pageRangesAfterFirst(1000, 2500)).toEqual([
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it("walks onward when a full page has no trustworthy total", () => {
    expect(pageRangesAfterFirst(1000, null)).toBeNull();
    expect(pageRangesAfterFirst(1000, undefined)).toBeNull();
    expect(pageRangesAfterFirst(1000, 0)).toBeNull();
  });
});