import { describe, it, expect } from "vitest";
import { getBitsSignature } from "@/lib/play/bits/bitsSignature";

/** Golden vector: must match public.bits_signature_v1 in SQL migrations. */
describe("getBitsSignature", () => {
  it("matches v1 fingerprint for a minimal one-question quiz", () => {
    const items = [{ question: "Q", options: ["a", "b"], correctAnswer: "a" }];
    expect(getBitsSignature(items)).toBe("v1-1-1115700974");
  });
});
