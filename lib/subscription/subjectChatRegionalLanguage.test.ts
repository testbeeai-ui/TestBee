import { describe, expect, it } from "vitest";
import {
  isRegionalSubjectChatCode,
  parseSubjectChatRegionalLanguage,
} from "@/lib/subscription/subjectChatRegionalLanguage";

describe("subjectChatRegionalLanguage", () => {
  it("accepts regional codes", () => {
    expect(isRegionalSubjectChatCode("kn")).toBe(true);
    expect(isRegionalSubjectChatCode("en")).toBe(false);
    expect(isRegionalSubjectChatCode("fr")).toBe(false);
  });

  it("parses profile values", () => {
    expect(parseSubjectChatRegionalLanguage("KN")).toBe("kn");
    expect(parseSubjectChatRegionalLanguage(null)).toBeNull();
    expect(parseSubjectChatRegionalLanguage("english")).toBeNull();
  });
});
