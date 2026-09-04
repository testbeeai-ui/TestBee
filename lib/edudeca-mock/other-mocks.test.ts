import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { parseLibraryExamFilter } from "@/lib/mock/mockPapersCatalog";

import {
  OTHER_MOCKS_CTA_LABEL,
  OTHER_MOCKS_DIALOG_TITLE,
  OTHER_MOCK_EXAMS,
  otherExamLibraryHref,
} from "./other-mocks";

describe("EduDeca other-mocks picker", () => {
  it("renames the CTA away from EduBlast mocks", () => {
    expect(OTHER_MOCKS_CTA_LABEL.toLowerCase()).toContain("other mocks");
    expect(OTHER_MOCKS_CTA_LABEL.toLowerCase()).not.toContain("edublast");
    expect(OTHER_MOCKS_DIALOG_TITLE).toBe("Also preparing for other exams?");
  });

  it("sends JEE Main and COMEDK to mock papers, BITSAT and KCET to past papers", () => {
    expect(OTHER_MOCK_EXAMS.map((exam) => exam.id)).toEqual([
      "jee-main",
      "comedk",
      "bitsat",
      "kcet",
    ]);

    const [jeeMain, comedk, bitsat, kcet] = OTHER_MOCK_EXAMS;
    expect(jeeMain?.title).toBe("JEE Main Mock Test");
    expect(jeeMain?.collection).toBe("mock");
    expect(jeeMain?.href).toBe(otherExamLibraryHref("jee-main", "mock"));
    expect(jeeMain?.href).toBe("/mock-test?tab=mock&exam=jee-main");

    expect(comedk?.title).toBe("COMEDK Mock Papers");
    expect(comedk?.collection).toBe("mock");
    expect(comedk?.href).toBe(otherExamLibraryHref("comedk", "mock"));
    expect(comedk?.href).toBe("/mock-test?tab=mock&exam=comedk");

    expect(bitsat?.title).toBe("BITSAT Past Papers");
    expect(kcet?.title).toBe("KCET Past Papers");
    expect(bitsat?.collection).toBe("past");
    expect(kcet?.collection).toBe("past");
    if (bitsat) {
      expect(bitsat.href).toBe(otherExamLibraryHref(bitsat.id, "past"));
      expect(bitsat.href).toBe("/mock-test?tab=past&exam=bitsat");
    }
    if (kcet) {
      expect(kcet.href).toBe(otherExamLibraryHref(kcet.id, "past"));
      expect(kcet.href).toBe("/mock-test?tab=past&exam=kcet");
    }
    expect(parseLibraryExamFilter("comedk")).toBe("comedk");
  });

  it("results and landing copy no longer say EduBlast mocks", () => {
    const src = readFileSync(
      path.resolve(__dirname, "../../components/edudeca-mock/EduDecaMockExperience.tsx"),
      "utf8",
    );
    expect(src).not.toMatch(/EduBlast mocks/i);
    expect(src).toContain("OTHER_MOCKS_CTA_LABEL");
    expect(src).toContain("OtherMocksDialog");
    expect(src).toContain("Back to EduDeca Mock Test");
  });

  it("quiz header opens the other-mocks picker from Explore other mocks", () => {
    const src = readFileSync(
      path.resolve(__dirname, "../../components/edudeca-mock/EduDecaMockExperience.tsx"),
      "utf8",
    );
    expect(src).toMatch(/screen === "quiz"[\s\S]*setOtherMocksOpen\(true\)/);
    expect(src).toContain("ExploreOtherMocksButton");
  });

  it("landing keeps Back, the levels browser, and Explore other mocks around Start Test", () => {
    const src = readFileSync(
      path.resolve(__dirname, "../../components/edudeca-mock/EduDecaMockExperience.tsx"),
      "utf8",
    );
    expect(src).toContain("Start Test →");
    expect(src).toContain("Back to EduDeca without finishing");
    expect(src).toContain("Show me other EduDeca Levels &amp; Sets");
    expect(src).toContain("OTHER_MOCKS_CTA_LABEL");
    expect(src).toContain("LevelsBrowserDialog");
    expect(src).toContain("setLevelsBrowserOpen");
    expect(src).toContain("setOtherMocksOpen(true)");
  });
});

describe("EduDeca levels browser", () => {
  it("lets students switch levels and pick any of the 20 sets", () => {
    const src = readFileSync(
      path.resolve(__dirname, "../../components/edudeca-mock/LevelsBrowserDialog.tsx"),
      "utf8",
    );
    expect(src).toContain("Choose an EduDeca Level &amp; Set");
    expect(src).toContain("Switching sets keeps each paper counted");
    expect(src).toContain("EDUDECA_MOCK_LEVELS");
    expect(src).toContain("EDUDECA_MOCK_SET_COUNT");
    expect(src).toContain("onSelect(tab, set)");
    expect(src).toContain("statuses");
  });

  it("pauses the paper being left when a student picks another set", () => {
    const src = readFileSync(
      path.resolve(__dirname, "../../components/edudeca-mock/EduDecaMockExperience.tsx"),
      "utf8",
    );
    expect(src).toContain("sessionAfterSelectingSet");
    expect(src).toContain("persistOtherPapers");
    expect(src).toContain("statuses={attemptStatuses}");
  });
});

describe("EduDeca mock page prerender", () => {
  it("force-dynamics the route and wraps AppLayout so useSearchParams can build", () => {
    const src = readFileSync(path.resolve(__dirname, "../../app/edudeca-mock/page.tsx"), "utf8");
    expect(src).toContain('export const dynamic = "force-dynamic"');
    expect(src).toMatch(/<Suspense[\s\S]*<AppLayout[\s\S]*EduDecaMockExperience/);
  });
});
