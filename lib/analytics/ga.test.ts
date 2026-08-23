import { describe, expect, it } from "vitest";
import { GA_MEASUREMENT_ID } from "./ga";

describe("GA_MEASUREMENT_ID", () => {
  it("resolves to the EduBlast GA4 property by default", () => {
    expect(GA_MEASUREMENT_ID).toMatch(/^G-[A-Z0-9]+$/);
    expect(GA_MEASUREMENT_ID).toBe(
      process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() || "G-YDE1GM358F",
    );
  });
});
