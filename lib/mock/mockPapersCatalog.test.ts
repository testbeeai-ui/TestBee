import { describe, expect, it } from "vitest";

import { paperMatchesExamFilter, parseLibraryExamFilter } from "./mockPapersCatalog";

describe("parseLibraryExamFilter", () => {
  it("accepts library chips including JEE Advanced", () => {
    expect(parseLibraryExamFilter("jee-main")).toBe("jee-main");
    expect(parseLibraryExamFilter("jee-advanced")).toBe("jee-advanced");
    expect(parseLibraryExamFilter("bitsat")).toBe("bitsat");
    expect(parseLibraryExamFilter("kcet")).toBe("kcet");
    expect(parseLibraryExamFilter("comedk")).toBe("comedk");
    expect(parseLibraryExamFilter("all")).toBe("all");
    expect(parseLibraryExamFilter("nope")).toBeNull();
    expect(parseLibraryExamFilter(null)).toBeNull();
  });
});

describe("paperMatchesExamFilter", () => {
  it("keeps exact exam_name matches", () => {
    expect(paperMatchesExamFilter("JEE Main", "jee-main")).toBe(true);
    expect(paperMatchesExamFilter("KCET", "kcet")).toBe(true);
    expect(paperMatchesExamFilter("BITSAT", "jee-main")).toBe(false);
  });

  it("matches JEE Advanced papers without treating them as JEE Main", () => {
    expect(paperMatchesExamFilter("JEE Advanced", "jee-advanced")).toBe(true);
    expect(paperMatchesExamFilter("JEE Advanced", "jee-main")).toBe(false);
    expect(paperMatchesExamFilter("JEE Main", "jee-advanced")).toBe(false);
  });
});
