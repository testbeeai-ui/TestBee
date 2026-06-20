import { describe, expect, it } from "vitest";
import {
  getProfPiUiLanguageContract,
  getProfPiUiLanguagePreserveClause,
  resolveProfPiUiLanguage,
} from "@/lib/gyanContentPolicy";

describe("profPi UI language helpers", () => {
  it("resolveProfPiUiLanguage returns Kannada for kn", () => {
    expect(resolveProfPiUiLanguage("kn")?.native).toBe("ಕನ್ನಡ");
    expect(resolveProfPiUiLanguage("en")).toBeNull();
  });

  it("getProfPiUiLanguageContract forces Kannada over English questions", () => {
    const contract = getProfPiUiLanguageContract("kn");
    expect(contract).toContain("ಕನ್ನಡ");
    expect(contract).toContain("do NOT reply in English");
    expect(contract).not.toContain("same language/script the student used");
  });

  it("preserve clause is empty for English", () => {
    expect(getProfPiUiLanguagePreserveClause("en")).toBe("");
    expect(getProfPiUiLanguagePreserveClause("kn")).toContain("ಕನ್ನಡ");
  });
});
