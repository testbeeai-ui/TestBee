import { describe, expect, it } from "vitest";
import { formatStudentId, normalizeStudentCode } from "./studentId";

describe("formatStudentId", () => {
  it("accepts year-based alternating codes", () => {
    expect(formatStudentId("EB-26A0B0C1")).toBe("EB-26A0B0C1");
    expect(formatStudentId("eb-26a0b0c1")).toBe("EB-26A0B0C1");
  });

  it("rejects legacy uuid-slice and invalid codes", () => {
    expect(formatStudentId("EB-F2952EE2")).toBeNull();
    expect(formatStudentId("EB-26A0B0")).toBeNull();
    expect(formatStudentId(null)).toBeNull();
    expect(normalizeStudentCode("")).toBeNull();
  });
});
