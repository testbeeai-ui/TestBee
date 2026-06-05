import { describe, expect, it } from "vitest";
import { effectiveMotivationRdmDelta } from "@/lib/teacherPortal/motivationRdm";

describe("effectiveMotivationRdmDelta (policy A)", () => {
  it("returns 0 without relatedPostId", () => {
    expect(effectiveMotivationRdmDelta(50, null)).toBe(0);
    expect(effectiveMotivationRdmDelta(50, undefined)).toBe(0);
    expect(effectiveMotivationRdmDelta(50, "   ")).toBe(0);
  });

  it("returns 0 for non-positive deltas even with assignment link", () => {
    expect(effectiveMotivationRdmDelta(0, "post-uuid")).toBe(0);
    expect(effectiveMotivationRdmDelta(-5, "post-uuid")).toBe(0);
    expect(effectiveMotivationRdmDelta(Number.NaN, "post-uuid")).toBe(0);
  });

  it("caps bonus at 500 when assignment-linked", () => {
    expect(effectiveMotivationRdmDelta(10, "abc")).toBe(10);
    expect(effectiveMotivationRdmDelta(501, "abc")).toBe(500);
  });

  it("counsel wizard: teacher UI may send 25 but server stores 0 without relatedPostId", () => {
    expect(effectiveMotivationRdmDelta(25, null)).toBe(0);
    expect(effectiveMotivationRdmDelta(50, undefined)).toBe(0);
  });

  it("assignment reminder: bonus applies only with relatedPostId", () => {
    expect(effectiveMotivationRdmDelta(10, "550e8400-e29b-41d4-a716-446655440000")).toBe(10);
  });
});
