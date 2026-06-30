import { describe, expect, it } from "vitest";
import {
  effectiveMotivationRdmDelta,
  normalizeInstantMotivationRdm,
} from "@/lib/teacherPortal/motivationRdm";

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

describe("syncStudentMotivationGrantsForAssignment", () => {
  it("delegates to tryFulfillAssignmentMotivationGrants", async () => {
    const { syncStudentMotivationGrantsForAssignment } = await import(
      "@/lib/teacherPortal/motivationRdm"
    );
    const admin = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        }),
      }),
    } as never;
    const result = await syncStudentMotivationGrantsForAssignment(admin, "student-1", "post-1");
    expect(result).toEqual({ fulfilled: 0, paidTotal: 0 });
  });
});

describe("normalizeInstantMotivationRdm", () => {
  it("returns 0 without positive delta", () => {
    expect(normalizeInstantMotivationRdm(0)).toBe(0);
    expect(normalizeInstantMotivationRdm(-3)).toBe(0);
  });

  it("caps instant recognition bonus at 500", () => {
    expect(normalizeInstantMotivationRdm(10)).toBe(10);
    expect(normalizeInstantMotivationRdm(600)).toBe(500);
  });
});
