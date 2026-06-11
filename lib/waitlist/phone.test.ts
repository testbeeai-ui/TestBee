import { describe, expect, it } from "vitest";
import { normalizeIndianMobile, sanitizeMobileInput } from "@/lib/waitlist/phone";

describe("sanitizeMobileInput", () => {
  it("strips +91 and spaces", () => {
    expect(sanitizeMobileInput("+91 7842 369939")).toBe("7842369939");
    expect(sanitizeMobileInput("+91 98765 43210")).toBe("9876543210");
  });

  it("caps at 10 digits", () => {
    expect(sanitizeMobileInput("9876543210123")).toBe("9876543210");
  });
});

describe("normalizeIndianMobile", () => {
  it("accepts clean 10-digit numbers", () => {
    expect(normalizeIndianMobile("9876543210")).toEqual({ ok: true, phone: "9876543210" });
  });

  it("normalizes +91 prefixed input", () => {
    expect(normalizeIndianMobile("+91 98765 43210")).toEqual({ ok: true, phone: "9876543210" });
  });

  it("rejects too short", () => {
    const r = normalizeIndianMobile("98765");
    expect(r.ok).toBe(false);
  });
});
