import { describe, expect, it } from "vitest";
import { formatCoachFormulaNote, parsePyqCoachFormulas, parsePyqCoachTips, splitCoachTipCallout } from "./pyqCoach";

describe("parsePyqCoachTips", () => {
  it("reads numbered start-moves from glm JSON", () => {
    const steps = parsePyqCoachTips(
      JSON.stringify({
        tips: [
          { title: "Spot symmetry", body: "Limits are $[-a,a]$." },
          { title: "Kill the odd piece", body: "$x^{11}$ is odd." },
        ],
      })
    );
    expect(steps).toEqual([
      { title: "Spot symmetry", body: "Limits are $[-a,a]$.", callout: "" },
      { title: "Kill the odd piece", body: "$x^{11}$ is odd.", callout: "" },
    ]);
  });

  it("keeps an explicit formula callout on the step", () => {
    const steps = parsePyqCoachTips(
      JSON.stringify({
        tips: [
          {
            title: "Use odd function symmetry",
            body: "Over the interval the $4x^{11}$ term is odd.",
            callout: "$\\int_{-\\pi/6}^{\\pi/6} \\frac{4x^{11}}{\\mathrm{denom}}\\,dx=0$",
          },
        ],
      })
    );
    expect(steps?.[0]?.callout).toContain("\\int");
  });

  it("lifts a trailing integral out of the prose", () => {
    expect(
      splitCoachTipCallout(
        "The $4x^{11}$ term is odd, so its integral vanishes. $\\int_{-a}^{a} 4x^{11} f(x)\\,dx=0$"
      )
    ).toEqual({
      body: "The $4x^{11}$ term is odd, so its integral vanishes.",
      callout: "$\\int_{-a}^{a} 4x^{11} f(x)\\,dx=0$",
    });
  });

  it("boxes a trailing identity after the sentence", () => {
    expect(
      splitCoachTipCallout(
        "Multiply by $\\frac{1+\\sin u}{1+\\sin u}$ to get $\\sec^2 u + \\sec u\\tan u$, an antiderivative $\\tan u + \\sec u$."
      )
    ).toEqual({
      body: "Multiply by $\\frac{1+\\sin u}{1+\\sin u}$ to get $\\sec^2 u + \\sec u\\tan u$, an antiderivative",
      callout: "$\\tan u + \\sec u$",
    });
  });

  it("does not box a short trailing power like $4x^{11}$", () => {
    expect(
      splitCoachTipCallout(
        "Separate the constant $\\pi$ term from the $4x^{11}$ term; each piece gets the same denominator."
      )
    ).toEqual({
      body: "Separate the constant $\\pi$ term from the $4x^{11}$ term; each piece gets the same denominator.",
      callout: "",
    });
  });

  it("is null for the old prose blob", () => {
    expect(parsePyqCoachTips("Limits are symmetric about $0$. Split the numerator.")).toBeNull();
  });
});

describe("parsePyqCoachFormulas", () => {
  it("reads one identity per card", () => {
    const items = parsePyqCoachFormulas(
      JSON.stringify({
        formulas: [
          { name: "Odd function", tex: "\\int_{-a}^{a} f(x)\\,dx=0", note: "when $f(-x)=-f(x)$" },
        ],
      })
    );
    expect(items).toEqual([
      { name: "Odd function", tex: "\\int_{-a}^{a} f(x)\\,dx=0", note: "when $f(-x)=-f(x)$" },
    ]);
  });

  it("is null when formulae were glued into one paragraph", () => {
    expect(
      parsePyqCoachFormulas("$\\int_{-a}^{a} f=0$ if $f$ is odd. $|x|$ is even; $x^{11}$ is odd.")
    ).toBeNull();
  });

  it("turns ascii sqrt in a formula name into KaTeX", () => {
    const items = parsePyqCoachFormulas(
      JSON.stringify({
        formulas: [
          {
            name: "Solutions of cos theta = sqrt3/2",
            tex: "\\theta=2n\\pi\\pm\\frac{\\pi}{6}",
            note: "first quadrant",
          },
          {
            name: "Solutions of cos theta = -1/sqrt2",
            tex: "\\theta=2n\\pi\\pm\\frac{3\\pi}{4}",
            note: "second quadrant",
          },
        ],
      })
    );
    expect(items?.[0]?.name).toBe("Solutions of $\\cos\\theta$ = $\\dfrac{\\sqrt{3}}{2}$");
    expect(items?.[1]?.name).toBe("Solutions of $\\cos\\theta$ = $-\\dfrac{1}{\\sqrt{2}}$");
  });

  it("leaves a name that already has \\sqrt alone", () => {
    const items = parsePyqCoachFormulas(
      JSON.stringify({
        formulas: [{ name: "Factor $(\\sqrt{3})$", tex: "\\sqrt{3}", note: "keep" }],
      })
    );
    expect(items?.[0]?.name).toBe("Factor $(\\sqrt{3})$");
  });

  it("recovers TeX \\frac that JSON parsed as a form-feed", () => {
    const loose =
      '{ "formulas": [{ "name": "Half", "tex": "a=-\\frac{3}{2}", "note": "signed" }] }';
    const items = parsePyqCoachFormulas(loose);
    expect(items?.[0]?.tex).toContain("\\frac{3}{2}");
    expect(items?.[0]?.tex).not.toContain("\f");
  });
});

describe("formatCoachFormulaNote", () => {
  it("prefixes a caption with Note :", () => {
    expect(formatCoachFormulaNote("Combine 2 sin into one sine")).toBe(
      "Note : Combine 2 sin into one sine"
    );
  });

  it("does not double an existing Note : label", () => {
    expect(formatCoachFormulaNote("Note : first quadrant")).toBe("Note : first quadrant");
    expect(formatCoachFormulaNote("note: already labeled")).toBe("Note : already labeled");
  });

  it("is empty when there is no caption", () => {
    expect(formatCoachFormulaNote("  ")).toBe("");
  });
});
