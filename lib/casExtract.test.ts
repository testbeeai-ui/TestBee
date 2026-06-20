import { describe, expect, it } from "vitest";

import { shouldRunCasVerification, translateEnglishHeadersToRegional } from "@/lib/casExtract";

describe("shouldRunCasVerification — language-independent detection", () => {
  it("fires on a Kannada doubt with an equation (no English keywords)", () => {
    expect(
      shouldRunCasVerification({
        subject: "math",
        doubtTitle: "ಇದನ್ನು ಬಿಡಿಸಿ",
        doubtBody: "$x^2 - 5x + 6 = 0$",
      })
    ).toBe(true);
  });

  it("fires on a Hindi integral doubt via the \\int symbol", () => {
    expect(
      shouldRunCasVerification({
        subject: "math",
        doubtTitle: "इसका मान ज्ञात करें",
        doubtBody: "$\\int x^2 \\, dx$",
      })
    ).toBe(true);
  });

  it("still skips chemistry", () => {
    expect(
      shouldRunCasVerification({
        subject: "chemistry",
        doubtTitle: "Solve",
        doubtBody: "$x = 0$",
      })
    ).toBe(false);
  });

  it("returns false when there is no operation or math content", () => {
    expect(
      shouldRunCasVerification({
        subject: "math",
        doubtTitle: "What is your name",
        doubtBody: "just a greeting",
      })
    ).toBe(false);
  });
});

describe("translateEnglishHeadersToRegional", () => {
  it("localizes plain English headers in a Kannada answer", () => {
    const input = "**Answer:** $x = 2, 3$\n\n**Steps:**\n- ಮೊದಲ ಹಂತ";
    const out = translateEnglishHeadersToRegional(input);
    expect(out).toContain("**ಉತ್ತರ:**");
    expect(out).toContain("**ಹಂತಗಳು:**");
    expect(out).not.toContain("**Answer:**");
  });

  it("preserves emoji prefixes and only swaps the keyword", () => {
    const input = "**📐 Formula:** $a^2 + b^2$\n\nಇದು ವಿವರಣೆ.\n\n**✅ Answer:** $c$";
    const out = translateEnglishHeadersToRegional(input);
    expect(out).toContain("**📐 ಸೂತ್ರ:**");
    expect(out).toContain("**✅ ಉತ್ತರ:**");
  });

  it("localizes Hindi (Devanagari) headers", () => {
    const input = "**Formula:** $E = mc^2$\n\nयह उत्तर है।\n\n**Answer:** $42$";
    const out = translateEnglishHeadersToRegional(input);
    expect(out).toContain("**सूत्र:**");
    expect(out).toContain("**उत्तर:**");
  });

  it("leaves a pure-English answer unchanged", () => {
    const input = "**Answer:** $x = 1$\n\n**Steps:**\n- first";
    expect(translateEnglishHeadersToRegional(input)).toBe(input);
  });

  it("does not touch the word Answer inside body prose", () => {
    const input = "**ಉತ್ತರ:** $x$\n\nThe Answer key is in the textbook.";
    const out = translateEnglishHeadersToRegional(input);
    expect(out).toContain("The Answer key is in the textbook.");
  });
});
