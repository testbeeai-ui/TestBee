import { describe, expect, it } from "vitest";
import { savedContentLimitToastCopy } from "@/lib/saved/savedContentSaveLimit";
import { isUnlimited } from "@/lib/subscription/subscriptionConfig";

describe("savedContentSaveLimit", () => {
  it("instacue toast mentions subscribe and cap count", () => {
    const copy = savedContentLimitToastCopy("saved_revision_card", 20);
    expect(copy.title).toContain("limit");
    expect(copy.description).toContain("20");
    expect(copy.description).toMatch(/Subscribe|Subscription/i);
  });

  it("quiz bits toast is type-specific", () => {
    const copy = savedContentLimitToastCopy("saved_bit", 20);
    expect(copy.title).toContain("Quiz");
    expect(copy.description).toContain("quiz question");
  });

  it("numerals toast is type-specific", () => {
    const copy = savedContentLimitToastCopy("saved_formula", 20);
    expect(copy.title).toContain("Numerals");
    expect(copy.description).toContain("formula");
  });

  it("save caps use -1 unlimited from subscription config convention", () => {
    expect(isUnlimited(-1)).toBe(true);
    expect(isUnlimited(20)).toBe(false);
  });
});
