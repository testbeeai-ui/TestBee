import { describe, it, expect } from "vitest";
import {
  buildProfPiVerifierUserContent,
  draftLooksLikeChemLatex,
  draftLooksLikeHeavyStemLatex,
  isProfPiVerifyEnabled,
  shouldRunProfPiVerifier,
} from "./profPiVerify";
import {
  PROF_PI_FACT_CONTRACT,
  getProfPiDefaultTemperatureForRagKey,
  getProfPiRephraseTemperatureForRagKey,
  getProfPiRetryTemperatureForRagKey,
} from "@/lib/gyanContentPolicy";

describe("draftLooksLikeChemLatex", () => {
  it("detects keto–enol style LaTeX", () => {
    const draft = String.raw`**Example:** $CH_3COCH_3 \rightleftharpoons CH_2=C(OH)CH_3$`;
    expect(draftLooksLikeChemLatex(draft)).toBe(true);
  });

  it("detects tautomer keyword with math", () => {
    const draft = "Tautomerism: see $CH_3-CO-CH_3$ vs enol.";
    expect(draftLooksLikeChemLatex(draft)).toBe(true);
  });

  it("returns false for plain kinematics without chem LaTeX", () => {
    const draft = "Use $v^2 = u^2 + 2as$ along the incline.";
    expect(draftLooksLikeChemLatex(draft)).toBe(false);
  });
});

describe("shouldRunProfPiVerifier", () => {
  it("always runs for rephrase source", () => {
    expect(
      shouldRunProfPiVerifier({
        draft: "Short text without latex",
        ragKey: "physics",
        source: "rephrase",
      })
    ).toBe(true);
  });

  it("runs for chemistry when draft looks like chem LaTeX", () => {
    expect(
      shouldRunProfPiVerifier({
        draft: String.raw`$CH_3COCH_3 \rightleftharpoons CH_2=C(OH)CH_3$`,
        ragKey: "chemistry",
        source: "rag_sarvam",
      })
    ).toBe(true);
  });

  it("skips chemistry plain prose without chem LaTeX signals", () => {
    expect(
      shouldRunProfPiVerifier({
        draft: "Tautomerism means interconversion of isomers with a proton shift.",
        ragKey: "chemistry",
        source: "rag_sarvam",
      })
    ).toBe(false);
  });

  it("runs for physics when draft has heavy STEM LaTeX", () => {
    const draft = String.raw`Use $$\int_0^T F\,dt$$ and also $p = mv$ for momentum.`;
    expect(
      shouldRunProfPiVerifier({
        draft,
        ragKey: "physics",
        source: "rag_sarvam",
      })
    ).toBe(true);
  });

  it("runs for math when draft has multiple substantive inline equations", () => {
    const draft = String.raw`Step 1: $x^2 + 2x + 1 = 0$. Step 2: $x^2 + 2x + 1 = (x+1)^2$ so roots.`;
    expect(
      shouldRunProfPiVerifier({
        draft,
        ragKey: "math",
        source: "rag_sarvam",
      })
    ).toBe(true);
  });
});

describe("draftLooksLikeHeavyStemLatex", () => {
  it("detects display math", () => {
    expect(draftLooksLikeHeavyStemLatex("See $$E = mc^2$$ for rest energy.")).toBe(true);
  });

  it("detects integrals in text", () => {
    expect(draftLooksLikeHeavyStemLatex(String.raw`\int_0^1 x\,dx`)).toBe(true);
  });
});

describe("buildProfPiVerifierUserContent", () => {
  it("includes question and draft markers", () => {
    const u = buildProfPiVerifierUserContent({
      title: "Why tautomerism?",
      body: "Confused about acetone.",
      draft: "**Answer**",
    });
    expect(u).toContain("STUDENT QUESTION TITLE:");
    expect(u).toContain("Why tautomerism?");
    expect(u).toContain("DRAFT ANSWER");
    expect(u).toContain("**Answer**");
  });
});

describe("PROF_PI_FACT_CONTRACT", () => {
  it("covers chemistry, physics, and math", () => {
    expect(PROF_PI_FACT_CONTRACT).toMatch(/atom balance/i);
    expect(PROF_PI_FACT_CONTRACT).toMatch(/Resonance/i);
    expect(PROF_PI_FACT_CONTRACT).toMatch(/Tautomerism/i);
    expect(PROF_PI_FACT_CONTRACT).toMatch(/Physics:/);
    expect(PROF_PI_FACT_CONTRACT).toMatch(/Mathematics:/);
  });
});

describe("getProfPiDefaultTemperatureForRagKey", () => {
  it("orders chemistry most deterministic, then math, then physics", () => {
    const chem = getProfPiDefaultTemperatureForRagKey("chemistry");
    const math = getProfPiDefaultTemperatureForRagKey("math");
    const phys = getProfPiDefaultTemperatureForRagKey("physics");
    expect(chem).toBeLessThanOrEqual(math);
    expect(math).toBeLessThanOrEqual(phys);
  });
});

describe("getProfPiRephraseTemperatureForRagKey", () => {
  it("keeps rephrase temps at or below 0.37 for non-chemistry", () => {
    expect(getProfPiRephraseTemperatureForRagKey("physics")).toBeLessThanOrEqual(0.37);
    expect(getProfPiRephraseTemperatureForRagKey("math")).toBeLessThanOrEqual(0.37);
  });
});

describe("getProfPiRetryTemperatureForRagKey", () => {
  it("uses chemistry lowest retry temp", () => {
    expect(getProfPiRetryTemperatureForRagKey("chemistry")).toBeLessThan(
      getProfPiRetryTemperatureForRagKey("physics")
    );
  });
});

describe("isProfPiVerifyEnabled", () => {
  it("is false when PROF_PI_VERIFY is unset", () => {
    const prev = process.env.PROF_PI_VERIFY;
    delete process.env.PROF_PI_VERIFY;
    expect(isProfPiVerifyEnabled()).toBe(false);
    if (prev !== undefined) process.env.PROF_PI_VERIFY = prev;
  });
});
